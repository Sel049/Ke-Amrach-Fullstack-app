import React from "react";
import Routes from "./Routes";
import { AuthProvider } from "./hooks/useAuth.jsx";
import { LanguageProvider } from "./hooks/useLanguage.jsx";
import { CartProvider } from "./hooks/useCart.jsx";
import { PublicSettingsProvider } from "./hooks/usePublicSettings.jsx";

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <CartProvider>
          <PublicSettingsProvider>
            <Routes />
          </PublicSettingsProvider>
        </CartProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
