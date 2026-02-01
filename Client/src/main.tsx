import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import App from "./App.tsx";
import "./index.css";
import { Toaster } from "./components/ui/toaster";
import { ScrollToTop } from "./components/shared";
import { CartProvider, UserProvider, WalletProvider } from "./context";
import { GOOGLE_CLIENT_ID } from "./config/env";

function Providers({ children }: { children: React.ReactNode }) {
	if (!GOOGLE_CLIENT_ID) return <>{children}</>;
	return <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>{children}</GoogleOAuthProvider>;
}

createRoot(document.getElementById("root")!).render(
	<Providers>
		<BrowserRouter>
			<ScrollToTop />
			<UserProvider>
				<CartProvider>
					<WalletProvider>
						<App />
						<Toaster />
					</WalletProvider>
				</CartProvider>
			</UserProvider>
		</BrowserRouter>
	</Providers>
);
