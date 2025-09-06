// import Dashboard from "./pages/Dashboard"
// import Home from "./pages/VillageHome"
// const App = () =>{
//     return(
//         <div>
//         <Dashboard/>
//         {/* <Home/> */}
//         </div>
//     );
// }
// export default App;
// App.jsx (example)
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Auth from "./pages/Auth.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Home from "./pages/VillageHome.jsx";
import FamilyList from "./pages/FamilyList";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Auth />} />
        <Route path="/login" element={<Auth />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/home" element={<Home />} />
        <Route path="/family" element={<FamilyList />} />
      </Routes>
    </BrowserRouter>
  );
}

