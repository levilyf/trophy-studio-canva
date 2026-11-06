import "@canva/app-ui-kit/styles.css";
import { AppI18nProvider } from "@canva/app-i18n-kit";
import { AppUiProvider } from "@canva/app-ui-kit";
import type { DesignEditorIntent } from "@canva/intents/design";
import { createRoot } from "react-dom/client";
import { App } from "./app";

async function render() {
  const element = document.getElementById("root");
  if (!element) throw new Error("Canva app root element was not found.");
  createRoot(element).render(<AppI18nProvider><AppUiProvider><App /></AppUiProvider></AppI18nProvider>);
}
const designEditor: DesignEditorIntent = { render };
export default designEditor;
