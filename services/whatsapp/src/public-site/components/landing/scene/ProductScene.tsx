import { FloatingGlassCard } from "./FloatingGlassCard";
import { Laptop3D } from "./Laptop3D";
import { Mark8Infinity } from "./Mark8Infinity";
import { Phone3D } from "./Phone3D";

export function ProductScene() {
  return (
    <div className="scene-wrap">
      <Mark8Infinity />
      <div className="scene-float">
        <div
          className="scene"
          data-scene-base="rotateX(7deg) rotateY(-11deg) rotateZ(1deg)"
          data-parallax-depth="0"
          data-parallax-base="rotateX(7deg) rotateY(-11deg) rotateZ(1deg)"
        >
          <div className="stage" id="scene-stage" data-parallax-depth="22">
            <Laptop3D />
            <Phone3D />
            <FloatingGlassCard title="AI Powered" body="Smarter Conversations" className="fc1" />
            <FloatingGlassCard title="Secure" body="Your Data, Our Priority" className="fc2" />
            <FloatingGlassCard title="Automate" body="Save Time" className="fc3" />
            <FloatingGlassCard title="Grow Faster" body="Real Results" className="fc4" />
          </div>
        </div>
      </div>
    </div>
  );
}
