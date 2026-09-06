ï»¿import { Laptop3D } from "./Laptop3D";

export function ProductScene() {
  return (
    <div className="scene" id="scene">
      <div className="stage" id="stage">
        <Laptop3D />

        <div className="float-card fc1">
          <small>Today&apos;s performance</small>
          <strong>+32.8%</strong>
          <div className="pulse">
            <i style={{ width: "22%" }} />
            <i style={{ width: "34%" }} />
            <i style={{ width: "18%" }} />
            <i style={{ width: "42%" }} />
          </div>
        </div>

        <div className="float-card fc2">
          <small>AI Employee</small>
          <div className="row">
            <div className="avatar" />
            <div>
              <strong className="v6-agent-title">Sales Agent</strong>
              <small>Online Â· 16 tasks</small>
            </div>
          </div>
        </div>

        <div className="float-card fc3">
          <div className="orb3d" />
        </div>
      </div>
    </div>
  );
}
