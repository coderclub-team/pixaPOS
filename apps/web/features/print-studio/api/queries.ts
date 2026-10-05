import { queryOptions } from "@tanstack/react-query";
import { getDefaultPrinter, getPrinters, getPrintJobs, getTemplate } from "./service";
import type { PrintFilters, PrintPurpose } from "./types";

export const printKeys = {
  all: ["print-studio"] as const,
  printers: () => [...printKeys.all, "printers"] as const,
  defaultPrinter: () => [...printKeys.all, "default-printer"] as const,
  template: (purpose: PrintPurpose) => [...printKeys.all, "template", purpose] as const,
  jobs: (filters?: PrintFilters) => [...printKeys.all, "jobs", filters ?? {}] as const,
};

export const printersQueryOptions = () =>
  queryOptions({ queryKey: printKeys.printers(), queryFn: () => getPrinters() });

export const defaultPrinterQueryOptions = () =>
  queryOptions({ queryKey: printKeys.defaultPrinter(), queryFn: () => getDefaultPrinter() });

export const templateQueryOptions = (purpose: PrintPurpose) =>
  queryOptions({ queryKey: printKeys.template(purpose), queryFn: () => getTemplate(purpose) });

export const printJobsQueryOptions = (filters?: PrintFilters) =>
  queryOptions({ queryKey: printKeys.jobs(filters), queryFn: () => getPrintJobs() });
