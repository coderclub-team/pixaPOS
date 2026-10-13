import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  addRunIncentive,
  applyLeave,
  approvePayrollRun,
  createEmployee,
  createHoliday,
  createLeaveType,
  createPayPeriod,
  createPayrollRun,
  decideLeave,
  deleteHoliday,
  overrideRunItem,
  saveHolidayRule,
  updateEmployee,
} from "./service";
import { payrollKeys } from "./queries";
import type { EmployeePayload, RunUnitInput } from "./types";

function useInvalidate() {
  const queryClient = useQueryClient();
  return {
    employees: () => queryClient.invalidateQueries({ queryKey: payrollKeys.employees() }),
    all: () => queryClient.invalidateQueries({ queryKey: payrollKeys.all }),
  };
}

export function useCreateEmployee() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: createEmployee,
    onSuccess: () => {
      inv.employees();
      toast.success("Employee added");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateEmployee() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<EmployeePayload> }) =>
      updateEmployee(id, payload),
    onSuccess: () => {
      inv.employees();
      toast.success("Employee updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateLeaveType() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: createLeaveType,
    onSuccess: () => {
      inv.all();
      toast.success("Leave type added");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useApplyLeave() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: applyLeave,
    onSuccess: () => {
      inv.all();
      toast.success("Leave request submitted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDecideLeave() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: ({
      id,
      action,
      remarks,
    }: {
      id: string;
      action: "approve" | "reject";
      remarks?: string;
    }) => decideLeave(id, action, remarks),
    onSuccess: (_d, v) => {
      inv.all();
      toast.success(v.action === "approve" ? "Leave approved" : "Leave rejected");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateHoliday() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: createHoliday,
    onSuccess: () => {
      inv.all();
      toast.success("Holiday added");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteHoliday() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: deleteHoliday,
    onSuccess: () => {
      inv.all();
      toast.success("Holiday removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSaveHolidayRule() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: saveHolidayRule,
    onSuccess: () => {
      inv.all();
      toast.success("Holiday pay rule saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreatePayPeriod() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: ({ start_date, end_date }: { start_date: string; end_date: string }) =>
      createPayPeriod(start_date, end_date),
    onSuccess: () => {
      inv.all();
      toast.success("Pay period created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreatePayrollRun() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: ({ pay_period_id, inputs }: { pay_period_id: string; inputs?: RunUnitInput[] }) =>
      createPayrollRun(pay_period_id, inputs),
    onSuccess: (d) => {
      inv.all();
      toast.success(
        d.unmarkedDays > 0
          ? `Payroll computed for ${d.itemCount} employee(s) · ${d.unmarkedDays} unmarked day(s) assumed present`
          : `Payroll computed for ${d.itemCount} employee(s)`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAddRunIncentive(runId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      payroll_item_id: string;
      name: string;
      amount: number;
      note?: string;
    }) => addRunIncentive(runId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.run(runId) });
      queryClient.invalidateQueries({ queryKey: payrollKeys.runs() });
      toast.success("Incentive added");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useOverrideRunItem(runId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      itemId,
      payload,
    }: {
      itemId: string;
      payload: Record<string, number | string | undefined>;
    }) => overrideRunItem(runId, itemId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.run(runId) });
      queryClient.invalidateQueries({ queryKey: payrollKeys.runs() });
      toast.success("Item updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useApprovePayrollRun() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: approvePayrollRun,
    onSuccess: () => {
      inv.all();
      toast.success("Payroll approved and locked");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
