// src/components/ImportModal.jsx — Import portfolio from screenshot or text paste
import { useState, useRef, useCallback } from "react";
import { X, Upload, ClipboardPaste, Image, FileText, Loader, Check, AlertTriangle } from "lucide-react";
import { T, mono, display } from "../theme/tokens";
import { fetchPrice, isC } from "../api/finance";
import { Btn } from "./ui/Shared";

// Parse text: try to extract ticker, quantity, avg price from various formats
function parseTextToHoldings(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const results = [];

  for (const line of lines) {
    // Skip obvious header lines
    if (/^(ticker|symbol|asset|name|stock|#|instrument)/i.test(line)) continue;
    if (/^[-=]+$/.test(line)) continue;

    // Try tab-separated: AAPL  10  150.00
    let parts = line.split(/\t+/).map(s => s.trim()).filter(Boolean);
    if (parts.length < 2) {
      // Try comma-separated: AAPL, 10, 150.00
      parts = line.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
    }
    if (parts.length < 2) {
      // Try space-separated: AAPL 10 150.00
      parts = line.split(/\s{2,}|\s+/).map(s => s.trim()).filter(Boolean);
    }

    if (parts.length >= 1) {
      // First part should be ticker (letters, dots, hyphens)
      const tkCandidate = parts[0].replace(/[^A-Za-z0-9.\-]/g, '').toUpperCase();
      if (!tkCandidate || tkCandidate.length > 10 || /^\d+$/.test(tkCandidate)) continue;

      // Find numeric values in remaining parts
      const nums = [];
      for (let i = 1; i < parts.length; i++) {
        const cleaned = parts[i].replace(/[$,₪€£%]/g, '').trim();
        const n = parseFloat(cleaned);
        if (!isNaN(n) && n > 0) nums.push(n);
      }

      const entry = { tk: tkCandidate, qty: null, avg: null, parsed: true };

      if (nums.length >= 2) {
        // Heuristic: smaller number is likely qty, larger is price (unless qty is clearly shares)
        // If first num < 100 and second > 10, assume qty, price
        entry.qty = nums[0];
        entry.avg = nums[1];
      } else if (nums.length === 1) {
        // Could be qty or price — guess based on magnitude
        if (nums[0] > 1000) {
          entry.avg = nums[0]; // Likely a price
        } else {
          entry.qty = nums[0];
        }
      }

      results.push(entry);
    }
  }

  return results;
}

const ImportModal = ({ onClose, onImport, toast }) => {
  const [mode, setMode] = useState('text'); // 'text' | 'image'
  const [text, setText] = useState('');
  const [imageData, setImageData] = useState(null);
  const [parsed, setParsed] = useState([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('input'); // 'input' | 'review' | 'importing'
  const fileRef = useRef(null);

  // Handle paste event (text or image)
  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        const reader = new FileReader();
        reader.onload = () => {
          setImageData(reader.result);
          setMode('image');
        };
        reader.readAsDataURL(blob);
        return;
      }
    }
    // If no image, let default text paste happen
  }, []);

  // Handle file upload
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        setImageData(reader.result);
        setMode('image');
      };
      reader.readAsDataURL(file);
    }
  };

  // Parse text input
  const parseText = () => {
    if (!text.trim()) { toast('Paste your portfolio data first', 'error'); return; }
    const results = parseTextToHoldings(text);
    if (results.length === 0) {
      toast('Could not parse any holdings. Try a different format.', 'error');
      return;
    }
    setParsed(results);
    setStep('review');
  };

  // Update parsed entry
  const updateParsed = (idx, field, val) => {
    setParsed(p => p.map((e, i) => i === idx ? { ...e, [field]: field === 'tk' ? val.toUpperCase() : parseFloat(val) || null } : e));
  };

  const removeParsed = (idx) => {
    setParsed(p => p.filter((_, i) => i !== idx));
  };

  // Import all parsed holdings
  const doImport = async () => {
    setStep('importing');
    const valid = parsed.filter(p => p.tk && p.qty && p.qty > 0);
    if (valid.length === 0) { toast('No valid entries to import', 'error'); setStep('review'); return; }

    let imported = 0;
    for (const entry of valid) {
      let price = entry.avg;
      // Fetch current price
      const live = await fetchPrice(entry.tk);
      const cur = live?.price || price || 0;
      const nm = live?.name || entry.tk;

      onImport({
        tk: entry.tk,
        nm,
        qty: entry.qty,
        avg: entry.avg || cur,
        cur,
        ch: live?.changePct || 0,
        tp: isC(entry.tk) ? 'crypto' : 'stock',
        entryDate: entry.entryDate || new Date().toISOString().slice(0, 10),
        decision: 'Thesis',
      });
      imported++;
    }

    toast(`Imported ${imported} positions`, 'success');
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: 520, maxWidth: '94vw', maxHeight: '85vh', overflow: 'auto', background: T.bg.card, border: `1px solid ${T.b1}`, borderRadius: 2, padding: 20, boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontFamily: display, fontSize: 20, color: T.t1 }}>Import Portfolio</div>
          <X size={16} style={{ color: T.t3, cursor: 'pointer' }} onClick={onClose} />
        </div>

        {/* ═══ STEP 1: INPUT ═══ */}
        {step === 'input' && (
          <>
            {/* Mode tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
              {[
                { id: 'text', icon: ClipboardPaste, label: 'Paste Text' },
                { id: 'image', icon: Image, label: 'Screenshot' },
              ].map(m => (
                <button key={m.id} onClick={() => setMode(m.id)} style={{
                  flex: 1, padding: '8px 12px', borderRadius: 2, cursor: 'pointer',
                  border: `1px solid ${mode === m.id ? T.accent : T.b1}`,
                  background: mode === m.id ? T.accent + '12' : 'transparent',
                  color: mode === m.id ? T.accent : T.t3,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  fontFamily: mono, fontSize: 10, fontWeight: 600,
                }}>
                  <m.icon size={12} /> {m.label}
                </button>
              ))}
            </div>

            {mode === 'text' && (
              <>
                <div style={{ fontFamily: mono, fontSize: 8, color: T.t3, marginBottom: 6, lineHeight: 1.6 }}>
                  Copy your portfolio table from any broker (eToro, IBKR, Robinhood, Trading212, etc.) and paste below.
                  <br />Format: <span style={{ color: T.t2 }}>TICKER &nbsp; QUANTITY &nbsp; AVG_PRICE</span> (one per line, tab/comma/space separated)
                </div>
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onPaste={handlePaste}
                  placeholder={"WIX\t10\t185.00\nMRNA\t20\t45.50\nBTC\t0.15\t62000\nBAC\t50\t38.20\nPFE\t100\t26.80\nCSCO\t30\t48.50\nT\t80\t22.10\nICL.TA\t200\t19.50"}
                  style={{
                    width: '100%', height: 180, padding: 10, borderRadius: 2,
                    background: T.bg.deep, border: `1px solid ${T.b1}`, color: T.t1,
                    fontFamily: mono, fontSize: 11, resize: 'vertical', outline: 'none',
                    boxSizing: 'border-box', lineHeight: 1.8,
                  }}
                />
                <div style={{ fontFamily: mono, fontSize: 7, color: T.t4, marginTop: 4 }}>
                  Tip: Ctrl+V to paste. If you paste a screenshot image, it will switch to image mode automatically.
                </div>
                <Btn primary onClick={parseText} style={{ width: '100%', justifyContent: 'center', marginTop: 10, padding: 10 }}>
                  <FileText size={12} /> Parse Holdings
                </Btn>
              </>
            )}

            {mode === 'image' && (
              <>
                <div style={{ fontFamily: mono, fontSize: 8, color: T.t3, marginBottom: 6, lineHeight: 1.6 }}>
                  Paste a screenshot (Ctrl+V) or upload an image of your portfolio.
                  <br />The system will attempt to extract holdings data.
                </div>

                {/* Drop / paste zone */}
                <div
                  onPaste={handlePaste}
                  tabIndex={0}
                  style={{
                    width: '100%', minHeight: 160, padding: 20, borderRadius: 2,
                    background: T.bg.deep, border: `2px dashed ${imageData ? T.accent : T.b1}`,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', boxSizing: 'border-box', outline: 'none',
                  }}
                  onClick={() => !imageData && fileRef.current?.click()}
                >
                  {imageData ? (
                    <div style={{ width: '100%' }}>
                      <img src={imageData} alt="Portfolio screenshot" style={{ width: '100%', borderRadius: 2, marginBottom: 8 }} />
                      <button onClick={(e) => { e.stopPropagation(); setImageData(null); }} style={{
                        background: 'transparent', border: `1px solid ${T.b1}`, color: T.t3,
                        fontFamily: mono, fontSize: 9, padding: '4px 10px', borderRadius: 2, cursor: 'pointer',
                      }}>
                        Clear & try another
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload size={24} color={T.t4} style={{ marginBottom: 8 }} />
                      <div style={{ fontFamily: mono, fontSize: 10, color: T.t3, textAlign: 'center' }}>
                        Click to upload or press Ctrl+V to paste screenshot
                      </div>
                      <div style={{ fontFamily: mono, fontSize: 8, color: T.t4, marginTop: 4 }}>
                        PNG, JPG, or clipboard image
                      </div>
                    </>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />

                {imageData && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ padding: '8px 12px', background: T.accent + '10', border: `1px solid ${T.accent}25`, borderRadius: 2, marginBottom: 8 }}>
                      <div style={{ fontFamily: mono, fontSize: 9, color: T.accent, fontWeight: 600 }}>
                        <AlertTriangle size={10} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                        Screenshot detected — manual extraction
                      </div>
                      <div style={{ fontFamily: mono, fontSize: 8, color: T.t3, marginTop: 3 }}>
                        AI vision parsing requires an API key. For now, look at your screenshot above and type the holdings below:
                      </div>
                    </div>
                    <textarea
                      value={text}
                      onChange={e => setText(e.target.value)}
                      placeholder={"Type what you see in the screenshot:\nWIX  10  185.00\nMRNA  20  45.50\nBTC  0.15  62000"}
                      style={{
                        width: '100%', height: 120, padding: 10, borderRadius: 2,
                        background: T.bg.deep, border: `1px solid ${T.b1}`, color: T.t1,
                        fontFamily: mono, fontSize: 11, resize: 'vertical', outline: 'none',
                        boxSizing: 'border-box', lineHeight: 1.8,
                      }}
                    />
                    <Btn primary onClick={parseText} style={{ width: '100%', justifyContent: 'center', marginTop: 8, padding: 10 }}>
                      <FileText size={12} /> Parse Holdings
                    </Btn>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ═══ STEP 2: REVIEW ═══ */}
        {step === 'review' && (
          <>
            <div style={{ fontFamily: mono, fontSize: 9, color: T.t3, marginBottom: 10 }}>
              Found {parsed.length} holdings. Review and edit before importing:
            </div>

            <div style={{ maxHeight: 350, overflowY: 'auto', marginBottom: 12 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: mono, fontSize: 10 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.b1}` }}>
                    {['Ticker', 'Quantity', 'Avg Price', ''].map(h => (
                      <th key={h} style={{ padding: '4px 6px', textAlign: 'left', color: T.t3, fontSize: 7, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 400 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsed.map((p, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${T.b1}10` }}>
                      <td style={{ padding: '4px 6px' }}>
                        <input value={p.tk} onChange={e => updateParsed(i, 'tk', e.target.value)}
                          style={{ width: 70, padding: '4px 6px', background: T.bg.deep, border: `1px solid ${T.b1}`, borderRadius: 2, color: T.t1, fontFamily: mono, fontSize: 11, fontWeight: 700, outline: 'none' }} />
                      </td>
                      <td style={{ padding: '4px 6px' }}>
                        <input type="number" value={p.qty || ''} onChange={e => updateParsed(i, 'qty', e.target.value)}
                          placeholder="qty"
                          style={{ width: 70, padding: '4px 6px', background: T.bg.deep, border: `1px solid ${T.b1}`, borderRadius: 2, color: T.t1, fontFamily: mono, fontSize: 11, outline: 'none' }} />
                      </td>
                      <td style={{ padding: '4px 6px' }}>
                        <input type="number" value={p.avg || ''} onChange={e => updateParsed(i, 'avg', e.target.value)}
                          placeholder="price"
                          style={{ width: 80, padding: '4px 6px', background: T.bg.deep, border: `1px solid ${T.b1}`, borderRadius: 2, color: T.t1, fontFamily: mono, fontSize: 11, outline: 'none' }} />
                      </td>
                      <td style={{ padding: '4px 6px' }}>
                        <button onClick={() => removeParsed(i)} style={{
                          background: 'transparent', border: 'none', color: T.r.m, cursor: 'pointer', fontSize: 10, fontFamily: mono,
                        }}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <Btn onClick={() => setStep('input')} style={{ flex: 1, justifyContent: 'center' }}>Back</Btn>
              <Btn primary onClick={doImport} style={{ flex: 1, justifyContent: 'center' }}>
                <Check size={12} /> Import {parsed.filter(p => p.tk && p.qty).length} Holdings
              </Btn>
            </div>
          </>
        )}

        {/* ═══ STEP 3: IMPORTING ═══ */}
        {step === 'importing' && (
          <div style={{ textAlign: 'center', padding: '30px 10px' }}>
            <Loader size={24} color={T.accent} style={{ marginBottom: 12, animation: 'spin 1s linear infinite' }} />
            <div style={{ fontFamily: display, fontSize: 16, color: T.t1, marginBottom: 6 }}>Importing Holdings</div>
            <div style={{ fontFamily: mono, fontSize: 9, color: T.t3 }}>Fetching live prices for each position...</div>
          </div>
        )}

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
};

export default ImportModal;
