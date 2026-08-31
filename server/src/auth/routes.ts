import { randomUUID } from 'crypto';
import { Router } from 'express';
import { createUser, findUserByEmail, findUserById, findUserByUsername, type User } from './user';
import { hashPassword, verifyPassword } from './password';
import { createAccessToken, createRefreshToken, verifyRefreshToken } from './jwt';
import { requireAuth, type AuthenticatedRequest } from './middleware';

export const authRouter = Router();

// Fester Dummy-Hash, gegen den wir vergleichen, wenn ein Login mit
// unbekannter E-Mail versucht wird. So dauert ein Login-Versuch mit
// existierender und mit nicht-existierender E-Mail gleich lang - sonst
// koennte man ueber die Antwortzeit erraten, welche E-Mails registriert sind.
let dummyHashPromise: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword('dummy-password-for-timing-safety');
  }
  return dummyHashPromise;
}

function issueTokens(user: User) {
  return {
    accessToken: createAccessToken({ sub: user.id, username: user.username }),
    refreshToken: createRefreshToken({ sub: user.id }),
  };
}

authRouter.post('/register', async (req, res) => {
  const { username, email, password } = req.body ?? {};

  if (typeof username !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'username, email und password sind erforderlich' });
    return;
  }

  const trimmedUsername = username.trim();
  if (trimmedUsername.length < 3 || password.length < 8) {
    res.status(400).json({ error: 'username muss mindestens 3, password mindestens 8 Zeichen haben' });
    return;
  }

  if (findUserByEmail(email) || findUserByUsername(trimmedUsername)) {
    res.status(409).json({ error: 'username oder email bereits vergeben' });
    return;
  }

  const passwordHash = await hashPassword(password);
  const user = createUser(trimmedUsername, email, passwordHash);

  res.status(201).json({ id: user.id, username: user.username, email: user.email, ...issueTokens(user) });
});

// Gastkonto ohne Formular: erzeugt einen Nutzer mit zufaelligem Namen/E-Mail/
// Passwort und gibt sofort ein Token-Paar zurueck. Nutzt dieselbe User-/JWT-
// Infrastruktur wie Register/Login, deshalb bleibt die WS-Token-Pflicht
// unveraendert - ein Gast ist einfach ein Nutzer, den sich der Server selbst
// ausgedacht hat, statt jemand, der ganz ohne Token spielen darf.
authRouter.post('/guest', async (req, res) => {
  const guestId = randomUUID();
  const username = `Gast-${guestId.slice(0, 6)}`;
  const email = `guest-${guestId}@guest.local`;
  const passwordHash = await hashPassword(randomUUID());

  const user = createUser(username, email, passwordHash);

  res.status(201).json({ id: user.id, username: user.username, email: user.email, ...issueTokens(user) });
});

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};

  if (typeof email !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'email und password sind erforderlich' });
    return;
  }

  const user = findUserByEmail(email);
  const hashToCheck = user ? user.passwordHash : await getDummyHash();
  const passwordValid = await verifyPassword(password, hashToCheck);

  if (!user || !passwordValid) {
    res.status(401).json({ error: 'email oder password falsch' });
    return;
  }

  res.status(200).json({ id: user.id, username: user.username, email: user.email, ...issueTokens(user) });
});

authRouter.post('/refresh', (req, res) => {
  const { refreshToken } = req.body ?? {};

  if (typeof refreshToken !== 'string') {
    res.status(400).json({ error: 'refreshToken ist erforderlich' });
    return;
  }

  try {
    const payload = verifyRefreshToken(refreshToken);
    const user = findUserById(payload.sub);
    if (!user) {
      res.status(401).json({ error: 'refreshToken ungueltig oder abgelaufen' });
      return;
    }

    res.status(200).json({ accessToken: createAccessToken({ sub: user.id, username: user.username }) });
  } catch {
    res.status(401).json({ error: 'refreshToken ungueltig oder abgelaufen' });
  }
});

authRouter.get('/me', requireAuth, (req, res) => {
  const { userId, username } = req as AuthenticatedRequest;
  res.status(200).json({ id: userId, username });
});
