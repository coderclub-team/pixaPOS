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
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const onScroll = () => setSticky(window.scrollY >= 80);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const onHome = pathUrl === "/";

  return (
    <header
      className={`ud-header top-0 left-0 z-40 flex w-full items-center ${
        sticky
          ? "shadow-nav fixed z-[999] border-b border-stroke bg-white/80 backdrop-blur-[5px] dark:border-dark-3/20 dark:bg-dark/10"
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
                  onHome && !sticky ? "text-white" : "text-dark dark:text-white"
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
                  } ${onHome && !sticky ? "bg-white" : "bg-dark dark:bg-white"}`}
                />
                <span
                  className={`relative my-1.5 block h-0.5 w-[30px] transition-all duration-300 ${
                    navbarOpen ? "opacity-0 " : " "
                  } ${onHome && !sticky ? "bg-white" : "bg-dark dark:bg-white"}`}
                />
                <span
                  className={`relative my-1.5 block h-0.5 w-[30px] transition-all duration-300 ${
                    navbarOpen ? "top-[-8px] -rotate-45" : " "
                  } ${onHome && !sticky ? "bg-white" : "bg-dark dark:bg-white"}`}
                />
              </button>
              <nav
                id="navbarCollapse"
                className={`navbar absolute right-0 z-30 w-[250px] rounded border-[.5px] border-body-color/50 bg-white px-6 py-4 duration-300 lg:visible lg:static lg:w-auto lg:border-none lg:!bg-transparent lg:p-0 lg:opacity-100 ${
                  navbarOpen ? "visibility top-full opacity-100" : "invisible top-[120%] opacity-0"
                } dark:border-body-color/20 dark:bg-dark-2 lg:dark:bg-transparent`}
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
                            ? "text-dark group-hover:text-primary dark:text-white dark:group-hover:text-primary"
                            : "text-body-color lg:text-white dark:text-white"
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
              <button
                aria-label="theme toggler"
                onClick={() => setDark(!dark)}
                className="flex h-8 w-8 cursor-pointer items-center justify-center text-body-color duration-300 dark:text-white"
              >
                {dark ? (
                  <svg viewBox="0 0 16 16" className="h-[22px] w-[22px] fill-current">
                    <path d="M4.50663 3.2267L3.30663 2.03337L2.36663 2.97337L3.55996 4.1667L4.50663 3.2267ZM2.66663 7.00003H0.666626V8.33337H2.66663V7.00003ZM8.66663 0.366699H7.33329V2.33337H8.66663V0.366699ZM13.6333 2.97337L12.6933 2.03337L11.5 3.2267L12.44 4.1667L13.6333 2.97337ZM11.4933 12.1067L12.6866 13.3067L13.6266 12.3667L12.4266 11.1734L11.4933 12.1067ZM13.3333 7.00003V8.33337H15.3333V7.00003H13.3333ZM7.99996 3.6667C5.79329 3.6667 3.99996 5.46003 3.99996 7.6667C3.99996 9.87337 5.79329 11.6667 7.99996 11.6667C10.2066 11.6667 12 9.87337 12 7.6667C12 5.46003 10.2066 3.6667 7.99996 3.6667ZM7.33329 14.9667H8.66663V13H7.33329V14.9667ZM2.36663 12.36L3.30663 13.3L4.49996 12.1L3.55996 11.16L2.36663 12.36Z" />
                  </svg>
                ) : (
                  <svg
                    viewBox="0 0 23 23"
                    className={`h-[30px] w-[30px] fill-current text-dark dark:hidden ${
                      !sticky && onHome && "text-white"
                    }`}
                  >
                    <path d="M16.6111 15.855C17.591 15.1394 18.3151 14.1979 18.7723 13.1623C16.4824 13.4065 14.1342 12.4631 12.6795 10.4711C11.2248 8.47905 11.0409 5.95516 11.9705 3.84818C10.8449 3.9685 9.72768 4.37162 8.74781 5.08719C5.7759 7.25747 5.12529 11.4308 7.29558 14.4028C9.46586 17.3747 13.6392 18.0253 16.6111 15.855Z" />
                  </svg>
                )}
              </button>
              <Link
                href={signInUrl()}
                className={`loginBtn px-7 py-3 text-base font-medium ${
                  !sticky && onHome ? "text-white" : "text-dark dark:text-white"
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
