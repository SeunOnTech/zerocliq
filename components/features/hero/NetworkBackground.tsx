"use client"

import { useEffect, useRef } from "react"
import { useTheme } from "next-themes"

interface Node {
    x: number
    y: number
    vx: number
    vy: number
    radius: number
    type: "token" | "user"
    tokenIndex?: number // Index in TOKENS array
    id: number
}

const TOKENS = [
    "https://assets.coingecko.com/coins/images/4128/large/solana.png", // SOL
    "https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png", // USDC
    "https://assets.coingecko.com/coins/images/325/large/Tether.png", // USDT
    "https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I", // BONK
    "https://static.jup.ag/jup/icon.png", // JUP
    "https://bafkreibk35wduktp5t7gwwnn26l4fag3d6yvp2ml2k3xfbe6dbkk2wx5yq.ipfs.nftstorage.link/", // WIF
    "https://assets.coingecko.com/coins/images/13928/standard/PSIG69vn_400x400.jpg", // RAY
    "https://assets.coingecko.com/coins/images/11636/standard/rndr.png", // RENDER
    "https://assets.coingecko.com/coins/images/4284/standard/helium.png", // HNT
    "https://assets.coingecko.com/coins/images/31924/standard/pyth.png", // PYTH
    "https://assets.coingecko.com/coins/images/17547/standard/Orca_Logo.png", // ORCA
    "https://assets.coingecko.com/coins/images/33564/standard/popcat.png", // POPCAT
    "https://assets.coingecko.com/coins/images/36412/standard/mew.png", // MEW
    "https://assets.coingecko.com/coins/images/35451/standard/bome.png", // BOME
    "https://assets.coingecko.com/coins/images/33228/standard/jito.png", // JTO
    "https://assets.coingecko.com/coins/images/36597/standard/tensor.png", // TNSR
    "https://assets.coingecko.com/coins/images/37670/standard/drift.png", // DRIFT
    "https://assets.coingecko.com/coins/images/37472/standard/kamino.png", // KMNO
    "https://assets.coingecko.com/coins/images/35087/standard/wormhole.png", // W
    "https://assets.coingecko.com/coins/images/38312/standard/io.png", // IO
]

export function NetworkBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const { theme } = useTheme()
    const animationRef = useRef<number>()

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext("2d")
        if (!ctx) return

        let nodes: Node[] = []
        // Array to store loaded images at their corresponding TOKEN index
        const tokenImages: (HTMLImageElement | null)[] = new Array(TOKENS.length).fill(null)
        let userIcon: HTMLImageElement | undefined

        // Initialize immediately
        const init = () => {
            resize()
            createNodes()
            animate()
            loadAssets() // Load assets in background
        }

        const loadAssets = async () => {
            // Load User Icon first
            const userImg = new Image()
            const svg = encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`)
            userImg.src = `data:image/svg+xml;charset=utf-8,${svg}`
            userImg.onload = () => {
                userIcon = userImg
            }

            // Load Tokens
            TOKENS.forEach((src, index) => {
                const img = new Image()
                img.src = src
                img.onload = () => {
                    tokenImages[index] = img
                }
            })
        }

        const resize = () => {
            if (!canvas) return
            const parent = canvas.parentElement
            if (parent && parent.clientWidth > 0) {
                canvas.width = parent.clientWidth
                canvas.height = parent.clientHeight
            } else {
                // Fallback if parent has no size yet
                canvas.width = window.innerWidth
                canvas.height = window.innerHeight
            }
        }

        const createNodes = () => {
            nodes = []
            // Reduce density significantly
            const nodeCount = Math.min(35, Math.floor((canvas.width * canvas.height) / 15000))

            // Create a shuffled list of available token indices
            const availableTokenIndices = Array.from({ length: TOKENS.length }, (_, i) => i)
            for (let i = availableTokenIndices.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [availableTokenIndices[i], availableTokenIndices[j]] = [availableTokenIndices[j], availableTokenIndices[i]];
            }

            for (let i = 0; i < nodeCount; i++) {
                // Determine type: try to make it a token if we have unique ones left
                // Otherwise fallback to user
                let isToken = Math.random() > 0.5 && availableTokenIndices.length > 0

                // If we forced it to be a token but ran out, switch to user
                if (isToken && availableTokenIndices.length === 0) {
                    isToken = false
                }

                let x, y

                // CLEAR TEXT AREA: All nodes must be on the right side (x > 35%)
                // Text is on the left
                const minX = canvas.width * 0.35
                const maxX = canvas.width * 0.95

                x = minX + Math.random() * (maxX - minX)

                if (isToken) {
                    // Tokens: centered vertically within the right side
                    y = canvas.height * (0.15 + Math.random() * 0.7)
                } else {
                    // User nodes: spread vertically across the whole height
                    y = canvas.height * Math.random()
                }

                // Gentle random velocity
                const vx = (Math.random() - 0.5) * 0.2
                const vy = (Math.random() - 0.5) * 0.2

                nodes.push({
                    id: i,
                    x,
                    y,
                    vx,
                    vy,
                    radius: isToken ? 18 : 14,
                    type: isToken ? "token" : "user",
                    tokenIndex: isToken ? availableTokenIndices.pop() : undefined
                })
            }
        }

        const animate = () => {
            if (!ctx || !canvas) return
            ctx.clearRect(0, 0, canvas.width, canvas.height)

            // Update and Draw Nodes
            nodes.forEach(node => {
                // Update position
                node.x += node.vx
                node.y += node.vy

                // Bounce off boundaries
                // Left boundary is the text area limit (35%)
                const minX = canvas.width * 0.35 + node.radius
                const maxX = canvas.width - node.radius
                const minY = node.radius
                const maxY = canvas.height - node.radius

                if (node.x < minX || node.x > maxX) node.vx *= -1
                if (node.y < minY || node.y > maxY) node.vy *= -1

                // Clamp positions to ensure they don't get stuck
                if (node.x < minX) node.x = minX
                if (node.x > maxX) node.x = maxX
                if (node.y < minY) node.y = minY
                if (node.y > maxY) node.y = maxY
            })

            // Draw Connections
            nodes.forEach(node => {
                nodes.forEach(otherNode => {
                    if (node.id === otherNode.id) return

                    const dx = node.x - otherNode.x
                    const dy = node.y - otherNode.y
                    const distance = Math.sqrt(dx * dx + dy * dy)
                    const maxDistance = 200

                    if (distance < maxDistance) {
                        const opacity = 1 - (distance / maxDistance)
                        ctx.beginPath()
                        ctx.moveTo(node.x, node.y)
                        ctx.lineTo(otherNode.x, otherNode.y)
                        ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.15})`
                        ctx.lineWidth = 1
                        ctx.stroke()
                    }
                })
            })

            // Draw Nodes
            nodes.forEach(node => {
                ctx.save()
                ctx.beginPath()
                ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2)

                // Node Background
                ctx.fillStyle = "rgba(15, 15, 25, 0.9)"
                ctx.fill()

                // Node Border
                ctx.strokeStyle = node.type === "token" ? "rgba(20, 241, 149, 0.4)" : "rgba(255, 255, 255, 0.3)"
                ctx.lineWidth = 1.5
                ctx.stroke()

                // Draw Icon
                if (node.type === "user" && userIcon) {
                    const size = node.radius * 1.2
                    ctx.drawImage(userIcon, node.x - size / 2, node.y - size / 2, size, size)
                } else if (node.type === "token" && node.tokenIndex !== undefined) {
                    const img = tokenImages[node.tokenIndex]
                    if (img) {
                        const size = node.radius * 1.2
                        ctx.drawImage(img, node.x - size / 2, node.y - size / 2, size, size)
                    }
                }

                ctx.restore()
            })

            animationRef.current = requestAnimationFrame(animate)
        }

        init()

        const handleResize = () => {
            resize()
            createNodes()
            // No need to call animate() here as the loop is running
        }

        window.addEventListener("resize", handleResize)

        return () => {
            window.removeEventListener("resize", handleResize)
            if (animationRef.current) cancelAnimationFrame(animationRef.current)
        }
    }, [theme])

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none opacity-60"
        />
    )
}
