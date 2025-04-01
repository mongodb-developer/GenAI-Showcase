"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, FileText, BarChart, Network, Database } from "lucide-react"
import { cn } from "@/lib/utils"

export function BottomNavigation() {
  const pathname = usePathname()

  const navItems = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      active: pathname === "/dashboard",
    },
    {
      name: "Content",
      href: "/dashboard/content",
      icon: FileText,
      active: pathname.includes("/dashboard/content"),
    },
    {
      name: "Analytics",
      href: "/dashboard/analytics",
      icon: BarChart,
      active: pathname.includes("/dashboard/analytics"),
    },
    {
      name: "Intelligence",
      href: "/dashboard/content-intelligence",
      icon: Network,
      active: pathname.includes("/dashboard/content-intelligence"),
    },
    {
      name: "Data Models",
      href: "/dashboard/mongodb-schema",
      icon: Database,
      active: pathname.includes("/dashboard/mongodb-schema"),
    },
  ]

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t">
      <div className="flex justify-between items-center px-2">
        {navItems.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              "flex flex-col items-center py-2 px-3 text-xs",
              item.active ? "text-primary" : "text-muted-foreground hover:text-primary",
            )}
          >
            <item.icon className={cn("h-5 w-5 mb-1", item.active ? "text-primary" : "text-muted-foreground")} />
            <span>{item.name}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
