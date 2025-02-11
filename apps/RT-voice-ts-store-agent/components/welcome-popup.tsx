import type React from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { MicrophoneSVG, CartSVG, ConversationSVG } from "./explanation-svgs"

interface WelcomePopupProps {
  isOpen: boolean
  onClose: () => void
}

export const WelcomePopup: React.FC<WelcomePopupProps> = ({ isOpen, onClose }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Welcome to Voice Grocery Assistant</DialogTitle>
          <DialogDescription>Here's how to use the app:</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex items-center gap-4">
            <MicrophoneSVG />
            <p>Click the "Start Voice Assistant" button to begin voice interaction.</p>
          </div>
          <div className="flex items-center gap-4">
            <ConversationSVG />
            <p>Speak naturally to search for products, add items to your cart, or place an order.</p>
          </div>
          <div className="flex items-center gap-4">
            <CartSVG />
            <p>Review your cart and complete your order using voice commands or the on-screen buttons.</p>
          </div>
        </div>
        <Button onClick={onClose}>Got it, let's start!</Button>
      </DialogContent>
    </Dialog>
  )
}
