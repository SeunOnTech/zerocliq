import Link from "next/link";
import { Github, Twitter, Cpu } from "lucide-react";

export function Footer() {
    return (
        <footer className="border-t border-white/10 bg-black py-12">
            <div className="container mx-auto px-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
                    <div className="col-span-1 md:col-span-2">
                        <Link href="/" className="flex items-center gap-2 mb-4">
                            <img src="/icon.png" alt="ZeroCliq" className="w-8 h-8 rounded-lg border border-primary/20" />
                            <span className="text-lg font-bold text-white tracking-tight">ZeroCliq</span>
                        </Link>
                        <p className="text-gray-400 text-sm max-w-xs leading-relaxed">
                            The intelligent interface for the EVM ecosystem. Automate yield, execute complex bundles, and experience DeFi without boundaries.
                        </p>
                    </div>

                    <div>
                        <h3 className="font-semibold text-white mb-4">Product</h3>
                        <ul className="space-y-2">
                            <li><Link href="/market" className="text-gray-400 hover:text-white text-sm transition-colors">Launch App</Link></li>
                            <li><Link href="#features" className="text-gray-400 hover:text-white text-sm transition-colors">Features</Link></li>
                            <li><Link href="#how-it-works" className="text-gray-400 hover:text-white text-sm transition-colors">How it Works</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="font-semibold text-white mb-4">Community</h3>
                        <ul className="space-y-2">
                            <li>
                                <a href="https://discord.gg/zerocliq" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors">
                                    <svg className="w-4 h-4 fill-current" viewBox="0 0 127.14 96.36">
                                        <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.29,105.29,0,0,0,19.46,8.07C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.89,105.89,0,0,0,126.6,80.22c2.36-24.44-5.42-48.18-18.9-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
                                    </svg>
                                    Discord
                                </a>
                            </li>
                            <li>
                                <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors">
                                    <Twitter className="w-4 h-4" /> Twitter
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-gray-500 text-sm">
                        © {new Date().getFullYear()} Zerocliq. All rights reserved.
                    </p>
                    <div className="flex gap-6">
                        <Link href="/terms" className="text-gray-500 hover:text-white text-sm transition-colors">Terms</Link>
                        <Link href="/privacy" className="text-gray-500 hover:text-white text-sm transition-colors">Privacy</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
