"use client"

import { motion } from "framer-motion"
import { useEffect, useState } from "react"

export function Particles() {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) return null

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none select-none z-0">
            {/* Particle 1: Rose - Orbiting Top Left to Bottom Right */}
            <motion.div
                className="absolute w-48 h-48 rounded-full bg-primary/20 blur-xl mix-blend-multiply dark:mix-blend-screen"
                animate={{
                    x: [0, 300, 0, -300, 0],
                    y: [0, 150, 300, 150, 0],
                    scale: [1, 1.2, 1, 0.8, 1],
                }}
                transition={{
                    duration: 25,
                    repeat: Infinity,
                    ease: "linear",
                }}
                style={{ top: '20%', left: '20%' }}
            />

            {/* Particle 2: Purple - Orbiting Bottom Right to Top Left */}
            <motion.div
                className="absolute w-56 h-56 rounded-full bg-purple-400/20 blur-xl mix-blend-multiply dark:mix-blend-screen"
                animate={{
                    x: [0, -200, 0, 200, 0],
                    y: [0, -150, -300, -150, 0],
                    scale: [1, 0.9, 1.1, 1, 1],
                }}
                transition={{
                    duration: 20,
                    repeat: Infinity,
                    ease: "linear",
                }}
                style={{ bottom: '20%', right: '20%' }}
            />


        </div>
    )
}
