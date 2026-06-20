import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Workspace from "@/pages/Workspace";
import Visualization3D from "@/pages/Visualization3D";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Workspace />} />
        <Route path="/3d" element={<Visualization3D />} />
      </Routes>
    </Router>
  );
}
