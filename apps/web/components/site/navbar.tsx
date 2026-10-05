"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signInUrl, signUpUrl } from "@/lib/site/site";
import { TRIAL_DAYS } from "@/lib/site/plans";

const MENU = [
  { title: "Surfaces", path: "/#surfaces" },
  { title: "Pricing", path: "/#pricing" },
  { title: "FAQ", path: "/#faq" },
];

export default function Header() {
  const pathUrl = usePathname();
  const [navbarOpen, setNavbarOpen] = useState(false);
  const [sticky, setSticky] = useState(false);

  useEffect(() => {
    const onScroll = () => setSticky(window.scrollY >= 80);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const onHome = pathUrl === "/";

  return (
    <header
      className={`ud-header top-0 left-0 z-40 flex w-full items-center ${
        sticky
          ? "shadow-nav fixed z-[999] border-b border-stroke bg-white/80 backdrop-blur-[5px]"
          : "absolute bg-transparent"
      }`}
    >
      <div className="container">
        <div className="relative -mx-4 flex items-center justify-between">
          <div className="w-60 max-w-full px-4">
            <Link
              href="/"
              className={`navbar-logo flex w-full items-center gap-2 ${sticky ? "py-2" : "py-5"}`}
            >
              <Image
                src="/logo.png"
                alt="pixaPOS"
                width={32}
                height={32}
                className="size-8 rounded-lg"
                priority
              />
              <span
                className={`text-xl font-bold tracking-tight ${
                  onHome && !sticky ? "text-white" : "text-dark"
                }`}
              >
                pixaPOS
              </span>
            </Link>
          </div>
          <div className="flex w-full items-center justify-between px-4">
            <div>
              <button
                onClick={() => setNavbarOpen(!navbarOpen)}
                id="navbarToggler"
                aria-label="Mobile Menu"
                className="absolute top-1/2 right-4 block -translate-y-1/2 rounded-lg px-3 py-[6px] ring-primary focus:ring-2 lg:hidden"
              >
                <span
                  className={`relative my-1.5 block h-0.5 w-[30px] transition-all duration-300 ${
                    navbarOpen ? "top-[7px] rotate-45" : " "
                  } ${onHome && !sticky ? "bg-white" : "bg-dark"}`}
                />
                <span
                  className={`relative my-1.5 block h-0.5 w-[30px] transition-all duration-300 ${
                    navbarOpen ? "opacity-0 " : " "
                  } ${onHome && !sticky ? "bg-white" : "bg-dark"}`}
                />
                <span
                  className={`relative my-1.5 block h-0.5 w-[30px] transition-all duration-300 ${
                    navbarOpen ? "top-[-8px] -rotate-45" : " "
                  } ${onHome && !sticky ? "bg-white" : "bg-dark"}`}
                />
              </button>
              <nav
                id="navbarCollapse"
                className={`navbar absolute right-0 z-30 w-[250px] rounded border-[.5px] border-body-color/50 bg-white px-6 py-4 duration-300 lg:visible lg:static lg:w-auto lg:border-none lg:!bg-transparent lg:p-0 lg:opacity-100 ${
                  navbarOpen ? "visibility top-full opacity-100" : "invisible top-[120%] opacity-0"
                }`}
              >
                <ul className="block lg:ml-8 lg:flex lg:gap-x-8 xl:ml-14 xl:gap-x-12">
                  {MENU.map((menuItem) => (
                    <li key={menuItem.title} className="group relative">
                      <Link
                        onClick={() => setNavbarOpen(false)}
                        scroll={false}
                        href={menuItem.path}
                        className={`ud-menu-scroll flex py-2 text-base lg:inline-flex lg:px-0 lg:py-6 ${
                          sticky
                            ? "text-dark group-hover:text-primary"
                            : "text-body-color lg:text-white"
                        }`}
                      >
                        {menuItem.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
            <div className="hidden items-center justify-end pr-16 sm:flex lg:pr-0">
              <Link
                href={signInUrl()}
                className={`loginBtn px-7 py-3 text-base font-medium ${
                  !sticky && onHome ? "text-white" : "text-dark"
                }`}
              >
                Log In
              </Link>
              {onHome && !sticky ? (
                <Link
                  href={signUpUrl()}
                  className="signUpBtn rounded-lg bg-white/20 px-6 py-3 text-base font-medium text-white duration-300 ease-in-out hover:bg-white hover:text-dark"
                >
                  Start {TRIAL_DAYS}-day trial
                </Link>
              ) : (
                <Link
                  href={signUpUrl()}
                  className="signUpBtn rounded-lg bg-primary px-6 py-3 text-base font-medium text-white duration-300 ease-in-out hover:bg-dark"
                >
                  Start {TRIAL_DAYS}-day trial
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
