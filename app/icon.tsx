import { BrainCircuit } from "lucide-react";
import { ImageResponse } from "next/og";

export const size = {
  width: 64,
  height: 64,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f5f2ea",
        }}
      >
        <BrainCircuit
          aria-hidden="true"
          color="#111111"
          size={46}
          strokeWidth={2.5}
        />
      </div>
    ),
    size
  );
}
