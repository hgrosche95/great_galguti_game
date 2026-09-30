// Schriftzug für Login, Warteraum und Spielkopf
function Brand({ subtitle }: { subtitle?: string }) {
  return (
    <div className="brand">
      <span className="brand-name">Great Galguti</span>
      {subtitle && <span className="brand-sub">{subtitle}</span>}
    </div>
  );
}

export default Brand;
