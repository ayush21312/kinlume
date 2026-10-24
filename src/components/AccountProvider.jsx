import { createContext, useContext, useState } from "react";
import useCommunity from "../hooks/useCommunity.js";
const AccountContext = createContext(null);
export function AccountProvider({ children }) {
  const community = useCommunity();
  const [showSignIn, setShowSignIn] = useState(true),
    [editingProfile, setEditingProfile] = useState(false);
  const account = {
    ...community,
    showSignIn,
    editingProfile,
    startSignIn: () => setShowSignIn(true),
    browseAsGuest: () => setShowSignIn(false),
    editProfile: () => setEditingProfile(true),
    cancelProfileEdit: () => setEditingProfile(false),
    saveProfile: async (profile) => {
      if (await community.saveProfile(profile)) {
        setEditingProfile(false);
        return true;
      }
      return false;
    },
    logout: async () => {
      if (await community.logout()) {
        setShowSignIn(true);
        setEditingProfile(false);
        return true;
      }
      return false;
    },
  };
  return (
    <AccountContext.Provider value={account}>
      {children}
    </AccountContext.Provider>
  );
}
export function useAccount() {
  const account = useContext(AccountContext);
  if (!account) throw new Error("AccountProvider is missing.");
  return account;
}
