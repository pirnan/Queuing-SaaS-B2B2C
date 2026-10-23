import React, { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

export default function QRCodeDisplay({ slug, establishmentName }) {
  const [copied, setCopied] = useState(false);
  const publicQueueUrl = slug 
    ? `${window.location.origin}/q/${slug}` 
    : window.location.origin;

  const handlePrint = () => {
    window.print();
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicQueueUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div style={{ 
      textAlign: "center", 
      padding: "24px 20px", 
      backgroundColor: "#FAF9F5",
      border: "1px solid #E5E3DC", 
      borderRadius: 14,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 12
    }}>
      <div>
        <span style={{
          fontSize: 12,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.6px",
          color: "#CC785C",
          display: "block",
          marginBottom: 4
        }}>
          Live Queue QR Code
        </span>
        <h3 style={{ 
          margin: 0, 
          fontFamily: "'Charter', 'Sitka Text', 'Cambria', Georgia, serif",
          fontSize: 20,
          fontWeight: 600,
          color: "#1F1E1D"
        }}>
          {establishmentName ? `Scan to Join ${establishmentName}` : "Scan to Join Queue"}
        </h3>
        <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "#73716B" }}>
          Customers scan this QR code on their phone to join the 3D queue
        </p>
      </div>

      <div style={{ 
        margin: "10px 0", 
        display: "inline-block", 
        background: "#FFFFFF", 
        padding: 18,
        borderRadius: 12,
        border: "1px solid #EAE8E1",
        boxShadow: "0 4px 16px rgba(31, 30, 29, 0.05)"
      }}>
        <QRCodeSVG value={publicQueueUrl} size={200} level="H" includeMargin={true} />
      </div>

      <div style={{
        backgroundColor: "#FFFFFF",
        border: "1px solid #DCD9D0",
        borderRadius: 8,
        padding: "8px 14px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        maxWidth: "100%",
        boxSizing: "border-box"
      }}>
        <span style={{ wordBreak: "break-all", fontSize: 13, color: "#1F1E1D", fontWeight: 500 }}>
          {publicQueueUrl}
        </span>
        <button
          type="button"
          onClick={handleCopyLink}
          style={{
            padding: "4px 10px",
            fontSize: 12,
            fontWeight: 600,
            backgroundColor: copied ? "rgba(78, 120, 94, 0.12)" : "#F7F5EE",
            color: copied ? "#3B6B52" : "#52504B",
            border: copied ? "1px solid rgba(78, 120, 94, 0.3)" : "1px solid #DCD9D0",
            borderRadius: 6,
            cursor: "pointer",
            whiteSpace: "nowrap",
            fontFamily: "inherit",
            transition: "all 0.15s ease"
          }}
        >
          {copied ? "✓ Copied!" : "Copy"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
        <button 
          onClick={handlePrint} 
          style={{ 
            padding: "8px 18px",
            backgroundColor: "#CC785C",
            color: "#FFFFFF",
            border: "none",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
            transition: "background 0.15s ease"
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#B85D3F")}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#CC785C")}
        >
          🖨️ Print QR Flyer
        </button>
      </div>
    </div>
  );
}
