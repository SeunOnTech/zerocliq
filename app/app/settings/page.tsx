// "use client";

// import { useState } from "react";
// import { useUserStore } from "@/hooks/useUserStore";
// import { useWallet } from "@solana/wallet-adapter-react";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
// import { motion, AnimatePresence } from "framer-motion";
// import {
//     Loader2,
//     RefreshCw,
//     Save,
//     User,
//     Bell,
//     Wallet,
//     Shield,
//     ExternalLink,
//     Copy,
//     Check,
//     LogOut,
// } from "lucide-react";
// import { cn } from "@/lib/utils";

// // Animated Toggle Component
// function Toggle({
//     checked,
//     onChange,
// }: {
//     checked: boolean;
//     onChange: (val: boolean) => void;
// }) {
//     return (
//         <button
//             onClick={() => onChange(!checked)}
//             className={cn(
//                 "relative w-10 h-5 rounded-full transition-colors duration-200",
//                 checked ? "bg-primary" : "bg-muted"
//             )}
//         >
//             <motion.div
//                 className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-background shadow-sm"
//                 animate={{ x: checked ? 20 : 0 }}
//                 transition={{ type: "spring", stiffness: 500, damping: 30 }}
//             />
//         </button>
//     );
// }

// // Settings Card Component
// function SettingsCard({
//     icon: Icon,
//     title,
//     children,
// }: {
//     icon: React.ElementType;
//     title: string;
//     children: React.ReactNode;
// }) {
//     return (
//         <motion.div
//             initial={{ opacity: 0, y: 10 }}
//             animate={{ opacity: 1, y: 0 }}
//             className="p-4 border border-border rounded-xl bg-card space-y-4"
//         >
//             <div className="flex items-center gap-2 text-sm font-semibold">
//                 <Icon className="h-4 w-4 text-primary" />
//                 {title}
//             </div>
//             {children}
//         </motion.div>
//     );
// }

// // Demo user data for when no real user exists
// const DEMO_USER = {
//     walletAddress: "DemoTrader123...ABC",
//     username: "CryptoKing",
//     avatarUrl: "https://api.dicebear.com/9.x/shapes/svg?seed=demo",
//     isVerified: true,
//     totalOrders: 156,
//     totalVolume: 45230.50,
//     completionRate: 98.5,
//     createdAt: new Date().toISOString(),
//     updatedAt: new Date().toISOString(),
// };

// export default function SettingsPage() {
//     const { user: realUser, updateUser } = useUserStore();
//     const { connected, publicKey, disconnect } = useWallet();

//     // Use demo data if no real user
//     const user = realUser || DEMO_USER;

//     const [username, setUsername] = useState(user?.username || "");
//     const [avatarSeed, setAvatarSeed] = useState(user?.walletAddress || "default");
//     const [isSaving, setIsSaving] = useState(false);
//     const [copied, setCopied] = useState(false);

//     // Notification preferences (demo state)
//     const [notifications, setNotifications] = useState({
//         orderFilled: true,
//         counterOffers: true,
//         messages: true,
//         marketing: false,
//     });

//     const generatedAvatar = `https://api.dicebear.com/9.x/shapes/svg?seed=${avatarSeed}`;

//     const handleSave = async () => {
//         if (!realUser) {
//             alert("Demo mode: Changes won't be saved");
//             return;
//         }

//         try {
//             setIsSaving(true);
//             const res = await fetch("/api/user/update", {
//                 method: "POST",
//                 headers: { "Content-Type": "application/json" },
//                 body: JSON.stringify({
//                     walletAddress: user.walletAddress,
//                     username,
//                     avatarUrl: generatedAvatar,
//                 }),
//             });

//             if (!res.ok) {
//                 const error = await res.json();
//                 alert(error.error || "Failed to update profile");
//                 return;
//             }

//             const updatedUser = await res.json();
//             updateUser(updatedUser);
//             alert("Profile updated successfully!");
//         } catch (err) {
//             console.error(err);
//             alert("Something went wrong");
//         } finally {
//             setIsSaving(false);
//         }
//     };

//     const handleCopyAddress = () => {
//         const address = publicKey?.toBase58() || user.walletAddress;
//         navigator.clipboard.writeText(address);
//         setCopied(true);
//         setTimeout(() => setCopied(false), 2000);
//     };

//     const handleDisconnect = () => {
//         disconnect();
//     };

//     if (!connected && !realUser) {
//         // Show demo settings
//     }

//     return (
//         <div className="max-w-2xl mx-auto space-y-6 p-4 md:p-6">
//             {/* Header */}
//             <motion.div
//                 initial={{ opacity: 0, y: -10 }}
//                 animate={{ opacity: 1, y: 0 }}
//                 className="space-y-1"
//             >
//                 <h1 className="text-xl font-bold tracking-tight">Settings</h1>
//                 <p className="text-sm text-muted-foreground">
//                     Manage your profile and preferences.
//                 </p>
//             </motion.div>

//             {/* Profile Section */}
//             <SettingsCard icon={User} title="Profile">
//                 <div className="flex items-start gap-4">
//                     <Avatar className="h-16 w-16 border border-border">
//                         <AvatarImage src={generatedAvatar} />
//                         <AvatarFallback className="text-lg">ZS</AvatarFallback>
//                     </Avatar>
//                     <div className="flex-1 space-y-3">
//                         <div className="space-y-1.5">
//                             <Label className="text-xs text-muted-foreground">Username</Label>
//                             <Input
//                                 value={username}
//                                 onChange={(e) => setUsername(e.target.value)}
//                                 placeholder="Enter username"
//                                 className="h-9 text-sm"
//                                 maxLength={20}
//                             />
//                         </div>
//                         <div className="flex items-center gap-2">
//                             <Button
//                                 variant="outline"
//                                 size="sm"
//                                 onClick={() => setAvatarSeed(Math.random().toString(36).substring(7))}
//                                 className="h-8 text-xs"
//                             >
//                                 <RefreshCw className="mr-1.5 h-3 w-3" />
//                                 New Avatar
//                             </Button>
//                         </div>
//                     </div>
//                 </div>
//             </SettingsCard>

//             {/* Notifications Section */}
//             <SettingsCard icon={Bell} title="Notifications">
//                 <div className="space-y-3">
//                     <div className="flex items-center justify-between py-1">
//                         <div>
//                             <p className="text-sm font-medium">Order Filled</p>
//                             <p className="text-xs text-muted-foreground">When your order is matched</p>
//                         </div>
//                         <Toggle
//                             checked={notifications.orderFilled}
//                             onChange={(val) => setNotifications({ ...notifications, orderFilled: val })}
//                         />
//                     </div>
//                     <div className="h-px bg-border" />
//                     <div className="flex items-center justify-between py-1">
//                         <div>
//                             <p className="text-sm font-medium">Counter Offers</p>
//                             <p className="text-xs text-muted-foreground">When someone makes an offer</p>
//                         </div>
//                         <Toggle
//                             checked={notifications.counterOffers}
//                             onChange={(val) => setNotifications({ ...notifications, counterOffers: val })}
//                         />
//                     </div>
//                     <div className="h-px bg-border" />
//                     <div className="flex items-center justify-between py-1">
//                         <div>
//                             <p className="text-sm font-medium">Messages</p>
//                             <p className="text-xs text-muted-foreground">Chat notifications</p>
//                         </div>
//                         <Toggle
//                             checked={notifications.messages}
//                             onChange={(val) => setNotifications({ ...notifications, messages: val })}
//                         />
//                     </div>
//                     <div className="h-px bg-border" />
//                     <div className="flex items-center justify-between py-1">
//                         <div>
//                             <p className="text-sm font-medium">Marketing</p>
//                             <p className="text-xs text-muted-foreground">News and updates</p>
//                         </div>
//                         <Toggle
//                             checked={notifications.marketing}
//                             onChange={(val) => setNotifications({ ...notifications, marketing: val })}
//                         />
//                     </div>
//                 </div>
//             </SettingsCard>

//             {/* Account Section */}
//             <SettingsCard icon={Wallet} title="Account">
//                 <div className="space-y-3">
//                     <div className="flex items-center justify-between py-1">
//                         <div>
//                             <p className="text-sm font-medium">Wallet Address</p>
//                             <p className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">
//                                 {publicKey?.toBase58() || user.walletAddress}
//                             </p>
//                         </div>
//                         <div className="flex items-center gap-1">
//                             <Button
//                                 variant="ghost"
//                                 size="icon"
//                                 className="h-8 w-8"
//                                 onClick={handleCopyAddress}
//                             >
//                                 <AnimatePresence mode="wait">
//                                     {copied ? (
//                                         <motion.div
//                                             key="check"
//                                             initial={{ scale: 0 }}
//                                             animate={{ scale: 1 }}
//                                             exit={{ scale: 0 }}
//                                         >
//                                             <Check className="h-3.5 w-3.5 text-green-500" />
//                                         </motion.div>
//                                     ) : (
//                                         <motion.div
//                                             key="copy"
//                                             initial={{ scale: 0 }}
//                                             animate={{ scale: 1 }}
//                                             exit={{ scale: 0 }}
//                                         >
//                                             <Copy className="h-3.5 w-3.5" />
//                                         </motion.div>
//                                     )}
//                                 </AnimatePresence>
//                             </Button>
//                             <Button
//                                 variant="ghost"
//                                 size="icon"
//                                 className="h-8 w-8"
//                                 onClick={() => {
//                                     const address = publicKey?.toBase58() || user.walletAddress;
//                                     window.open(`https://explorer.solana.com/address/${address}?cluster=devnet`, "_blank");
//                                 }}
//                             >
//                                 <ExternalLink className="h-3.5 w-3.5" />
//                             </Button>
//                         </div>
//                     </div>
//                     {connected && (
//                         <>
//                             <div className="h-px bg-border" />
//                             <Button
//                                 variant="ghost"
//                                 size="sm"
//                                 onClick={handleDisconnect}
//                                 className="w-full h-9 text-sm text-destructive hover:text-destructive hover:bg-destructive/10"
//                             >
//                                 <LogOut className="mr-2 h-3.5 w-3.5" />
//                                 Disconnect Wallet
//                             </Button>
//                         </>
//                     )}
//                 </div>
//             </SettingsCard>

//             {/* Save Button */}
//             <motion.div
//                 initial={{ opacity: 0 }}
//                 animate={{ opacity: 1 }}
//                 transition={{ delay: 0.3 }}
//             >
//                 <Button
//                     onClick={handleSave}
//                     disabled={isSaving}
//                     className="w-full h-10 text-sm font-semibold"
//                 >
//                     {isSaving ? (
//                         <>
//                             <Loader2 className="mr-2 h-4 w-4 animate-spin" />
//                             Saving...
//                         </>
//                     ) : (
//                         <>
//                             <Save className="mr-2 h-4 w-4" />
//                             Save Changes
//                         </>
//                     )}
//                 </Button>
//             </motion.div>
//         </div>
//     );
// }
