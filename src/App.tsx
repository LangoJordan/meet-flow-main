import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { PWAProvider } from "@/context/PWAContext";
import { IncomingCallProvider } from "@/context/IncomingCallContext";
import { OutgoingCallProvider } from "@/context/OutgoingCallContext";
import { GlobalPrompts } from "@/components/GlobalPrompts";
import { MessagesProvider } from "@/context/MessagesContext";
import { GroupsProvider } from "@/context/GroupsContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Contacts from "./pages/Contacts";
import ContactForm from "./pages/ContactForm";
import CallHistory from "./pages/CallHistory";
import CallDetails from "./pages/CallDetails";
import Invitations from "./pages/Invitations";
import InvitationForm from "./pages/InvitationForm";
import GroupCallForm from "./pages/GroupCallForm";
import Meeting from "./pages/Meeting";
import Settings from "./pages/Settings";
import Messages from "./pages/Messages";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  // Appliquer le thème (clair/sombre) globalement dès le chargement
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const stored = window.localStorage.getItem("theme");

    if (stored === "dark") {
      root.classList.add("dark");
    } else if (stored === "light") {
      root.classList.remove("dark");
    } else {
      // Fallback sur la préférence système
      const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (prefersDark) {
        root.classList.add("dark");
        window.localStorage.setItem("theme", "dark");
      } else {
        root.classList.remove("dark");
        window.localStorage.setItem("theme", "light");
      }
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <PWAProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <OutgoingCallProvider>
              <IncomingCallProvider>
                <MessagesProvider>
                  <GroupsProvider>
                    <GlobalPrompts />
                    <Routes>
                      <Route path="/" element={<Home />} />
                      <Route path="/login" element={<Login />} />
                      <Route path="/register" element={<Register />} />
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/contacts" element={<Contacts />} />
                      <Route path="/contacts/new" element={<ContactForm />} />
                      <Route path="/contacts/:id/edit" element={<ContactForm />} />
                      <Route path="/calls" element={<CallHistory />} />
                      <Route path="/calls/:id" element={<CallDetails />} />
                      <Route path="/invitations" element={<Invitations />} />
                      <Route path="/invitations/new" element={<InvitationForm />} />
                      <Route path="/group-call/new" element={<GroupCallForm />} />
                      <Route path="/meeting/:id" element={<Meeting />} />
                      <Route path="/messages" element={<Messages />} />
                      <Route path="/settings" element={<Settings />} />
                      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </GroupsProvider>
                </MessagesProvider>
              </IncomingCallProvider>
            </OutgoingCallProvider>
          </BrowserRouter>
        </TooltipProvider>
      </PWAProvider>
    </QueryClientProvider>
  );
};

export default App;
