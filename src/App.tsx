import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import EmergencyPage from "./pages/EmergencyPage";

function App() {
  return (
    <Router>
      <Routes>
        {/* User View */}
        <Route path="/" element={<EmergencyPage />} />
        {/* Doctor View */}
        <Route path="/view" element={<EmergencyPage />} />
      </Routes>
    </Router>
  );
}

export default App;
