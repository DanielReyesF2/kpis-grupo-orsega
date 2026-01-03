import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/theme.css";
import "./styles/tokens.css";
import "./styles/salesforce.css";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
