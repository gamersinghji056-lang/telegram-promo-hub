import { Laptop3D } from "./Laptop3D";
import { Mark8Infinity } from "./Mark8Infinity";

export function ProductScene() {
  return (
    <div className="scene-wrap">
      <Mark8Infinity />
      <div className="scene" id="scene" data-parallax-base="none">
        <div className="stage" id="stage" data-parallax-depth="22">
          <Laptop3D />
          <div className="float-card fc1" data-parallax-depth="8">
            <small>Today&apos;s performance</small>
            <strong>+32.8%</strong>
            <div className="pulse"><i style={{ width: "22%" }} /><i style={{ width: "34%" }} /><i style={{ width: "18%" }} /><i style={{ width: "42%" }} /></div>
          </div>
          <div className="float-card fc2" data-parallax-depth="12">
            <small>AI Employee</small>
            <div className="row"><div className="avatar" /><div><strong className="v6-agent-title">Sales Agent</strong><small>Online · 16 tasks</small></div></div>
          </div>
          <div className="float-card fc3" data-parallax-depth="16"><div className="orb3d" /></div>
        </div>
      </div>
    </div>
  );
}

