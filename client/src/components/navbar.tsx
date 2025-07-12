"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Menu, User, LogOut, Settings } from "lucide-react"
import { useAuth } from "@/context/AuthContext" // Adjust path as needed

export default function Navbar() {
  const { isAuthenticated, username, logout, loading } = useAuth()

  const getInitials = (name: string | null) => {
    if (!name) return "U"
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const AuthButtons = () => {
    if (loading) {
      return (
        <div className="flex gap-2">
          <div className="h-9 w-16 bg-muted animate-pulse rounded-md" />
          <div className="h-9 w-20 bg-muted animate-pulse rounded-md" />
        </div>
      )
    }

    if (isAuthenticated) {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src="/placeholder.svg" alt={username || "User"} />
                <AvatarFallback>{getInitials(username)}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{username || "User"}</p>
                <p className="text-xs leading-none text-muted-foreground">Welcome back!</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile" className="cursor-pointer">
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings" className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }

    return (
      <div className="flex gap-2">
        <Button variant="ghost" asChild>
          <Link href="/login">Log in</Link>
        </Button>
        <Button asChild>
          <Link href="/signup">Sign up</Link>
        </Button>
      </div>
    )
  }

  const MobileAuthButtons = () => {
    if (loading) {
      return (
        <div className="space-y-2">
          <div className="h-9 w-full bg-muted animate-pulse rounded-md" />
          <div className="h-9 w-full bg-muted animate-pulse rounded-md" />
        </div>
      )
    }

    if (isAuthenticated) {
      return (
        <div className="space-y-4">
          <div className="flex items-center space-x-3 px-3 py-2 rounded-lg bg-muted/50">
            <Avatar className="h-8 w-8">
              <AvatarImage src="/placeholder.svg" alt={username || "User"} />
              <AvatarFallback>{getInitials(username)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">{username || "User"}</p>
              <p className="text-xs text-muted-foreground">Welcome back!</p>
            </div>
          </div>
          <div className="space-y-2">
            <Button variant="ghost" className="w-full justify-start" asChild>
              <Link href="/profile">
                <User className="mr-2 h-4 w-4" />
                Profile
              </Link>
            </Button>
            <Button variant="ghost" className="w-full justify-start" asChild>
              <Link href="/settings">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start text-red-600 hover:text-red-600 hover:bg-red-50"
              onClick={logout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </Button>
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-2">
        <Button variant="ghost" className="w-full" asChild>
          <Link href="/login">Log in</Link>
        </Button>
        <Button className="w-full" asChild>
          <Link href="/signup">Sign up</Link>
        </Button>
      </div>
    )
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        {/* Logo */}
        <div className="mr-4 flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <div className="h-6 w-6 bg-primary rounded-sm" />
            <span className="hidden font-bold sm:inline-block">Your App</span>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
            <Link href="/features" className="transition-colors hover:text-foreground/80 text-foreground/60">
              Features
            </Link>
            <Link href="/pricing" className="transition-colors hover:text-foreground/80 text-foreground/60">
              Pricing
            </Link>
            <Link href="/about" className="transition-colors hover:text-foreground/80 text-foreground/60">
              About
            </Link>
            <Link href="/contact" className="transition-colors hover:text-foreground/80 text-foreground/60">
              Contact
            </Link>
          </nav>
          <div className="hidden md:flex">
            <AuthButtons />
          </div>
        </div>

        {/* Mobile Navigation */}
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              className="mr-2 px-0 text-base hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 md:hidden"
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="pr-0">
            <Link href="/" className="flex items-center space-x-2">
              <div className="h-6 w-6 bg-primary rounded-sm" />
              <span className="font-bold">Your App</span>
            </Link>
            <div className="my-4 h-[calc(100vh-8rem)] pb-10 pl-6">
              <div className="flex flex-col space-y-3">
                <Link href="/features" className="text-foreground/60 transition-colors hover:text-foreground">
                  Features
                </Link>
                <Link href="/pricing" className="text-foreground/60 transition-colors hover:text-foreground">
                  Pricing
                </Link>
                <Link href="/about" className="text-foreground/60 transition-colors hover:text-foreground">
                  About
                </Link>
                <Link href="/contact" className="text-foreground/60 transition-colors hover:text-foreground">
                  Contact
                </Link>
              </div>
              <div className="mt-6 pt-6 border-t">
                <MobileAuthButtons />
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
