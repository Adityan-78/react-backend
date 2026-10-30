// ===== Imports =====
import { useState } from "react";
import { ImageOff } from "lucide-react";

// ===== The ProductImage component =====
// Shows the reference picture of a new-product request. If the link cannot be
// shown (broken link, or the browser blocks it), a grey placeholder appears instead.
export default function ProductImage({ url }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return (
      <div className="request-image empty">
        <ImageOff size={24} />
        <span className="small">No preview</span>
      </div>
    );
  }
  return <img className="request-image" src={url} alt="Reference" onError={() => setFailed(true)} />;
}
