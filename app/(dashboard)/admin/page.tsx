"use client";

import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  CheckCircle2,
  Clock3,
  Mail,
  ShieldAlert,
  ShieldCheck,
  User as UserIcon,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { apiPath, appPath } from "@/lib/app-path";

type UserStatus = "PENDING" | "APPROVED" | "BANNED";
type UserRole = "ADMIN" | "USER";
type StatusFilter = "ALL" | UserStatus;
type RoleFilter = "ALL" | UserRole;
type AdminAction =
  | "APPROVE"
  | "BAN"
  | "UNBAN"
  | "MAKE_ADMIN"
  | "REVOKE_ADMIN"
  | "GRANT_INVOICE_ACCESS"
  | "REVOKE_INVOICE_ACCESS";

type AdminUser = {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  status: UserStatus;
  canAccessInvoiceData: boolean;
};

export default function AdminDashboard() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const currentUserEmail = session?.user?.email;

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [manageUserId, setManageUserId] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push(appPath("/login"));
      return;
    }
    if (authStatus === "authenticated") {
      if ((session?.user as any)?.role !== "ADMIN") {
        router.push(appPath("/"));
        return;
      }
      void fetchUsers();
    }
  }, [authStatus, router, session]);

  const fetchUsers = async () => {
    try {
      const res = await fetch(apiPath("/admin/users"));
      if (!res.ok) throw new Error("Failed to load users");
      const data = (await res.json()) as AdminUser[];
      setUsers(data);
    } catch {
      toast.error("Failed to load users.");
    } finally {
      setLoading(false);
    }
  };

  const runAction = async (userId: string, action: AdminAction) => {
    const needsConfirm =
      action === "BAN" || action === "REVOKE_ADMIN" || action === "REVOKE_INVOICE_ACCESS";
    if (needsConfirm) {
      const ok = window.confirm("Please confirm this change.");
      if (!ok) return;
    }

    try {
      setBusyUserId(userId);
      const res = await fetch(apiPath("/admin/users"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message || data?.error || "Update failed");
      }

      toast.success("User access updated.");
      await fetchUsers();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update user.");
    } finally {
      setBusyUserId(null);
    }
  };

  const summary = useMemo(() => {
    const pending = users.filter((u) => u.status === "PENDING").length;
    const approved = users.filter((u) => u.status === "APPROVED").length;
    const blocked = users.filter((u) => u.status === "BANNED").length;
    const admins = users.filter((u) => u.role === "ADMIN").length;
    const invoiceEnabled = users.filter((u) => u.canAccessInvoiceData).length;
    return { pending, approved, blocked, admins, invoiceEnabled, total: users.length };
  }, [users]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (statusFilter !== "ALL" && u.status !== statusFilter) return false;
      if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
      return true;
    });
  }, [users, statusFilter, roleFilter]);

  const manageUser = useMemo(
    () => filteredUsers.find((u) => u.id === manageUserId) || users.find((u) => u.id === manageUserId) || null,
    [filteredUsers, manageUserId, users]
  );

  if (loading || authStatus === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 pb-16 px-3 sm:px-5 lg:px-8">
      <header className="px-1">
        <div className="flex items-center gap-2 text-red-600 mb-2">
          <ShieldAlert className="w-4 h-4" />
          <span className="text-xs font-medium text-slate-500">Control Panel</span>
        </div>
        <h1 className="text-xl font-semibold text-slate-900">Access Management</h1>
        <p className="text-sm text-slate-500 mt-1">Approve users and manage role and invoice access.</p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard label="Pending" value={summary.pending} tone="amber" />
        <SummaryCard label="Approved" value={summary.approved} tone="green" />
        <SummaryCard label="Blocked" value={summary.blocked} tone="red" />
        <SummaryCard label="Admins" value={summary.admins} tone="slate" />
        <SummaryCard label="Invoice On" value={summary.invoiceEnabled} tone="blue" />
      </section>

      <section className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 mr-1">Status</span>
          {(["ALL", "PENDING", "APPROVED", "BANNED"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                statusFilter === f
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {f}
            </button>
          ))}
          <span className="text-xs font-semibold text-slate-500 ml-3 mr-1">Role</span>
          {(["ALL", "ADMIN", "USER"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setRoleFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                roleFilter === f
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {f}
            </button>
          ))}
          <span className="ml-auto text-xs text-slate-500">
            {filteredUsers.length} of {summary.total} users
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[860px]">
            <thead className="bg-slate-50/70 border-b border-slate-100">
              <tr>
                <th className="px-6 py-3.5 text-xs font-medium text-slate-500">User</th>
                <th className="px-6 py-3.5 text-xs font-medium text-slate-500">Account</th>
                <th className="px-6 py-3.5 text-xs font-medium text-slate-500">Role</th>
                <th className="px-6 py-3.5 text-xs font-medium text-slate-500">Invoice</th>
                <th className="px-6 py-3.5 text-xs font-medium text-slate-500 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((u) => {
                const isSelf = u.email === currentUserEmail;
                const isBusy = busyUserId === u.id;
                return (
                  <tr key={u.id} className="hover:bg-slate-50/40">
                    <td className="px-6 py-4.5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
                          <UserIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">{u.name || "Unknown User"}</div>
                          <div className="text-xs text-slate-500 flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {u.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4.5">
                      <StatusBadge status={u.status} />
                    </td>
                    <td className="px-6 py-4.5">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="px-6 py-4.5">
                      <InvoiceBadge enabled={u.canAccessInvoiceData} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      {isSelf ? (
                        <span className="text-xs text-slate-400 font-medium">No self-edit</span>
                      ) : (
                        <button
                          disabled={isBusy}
                          onClick={() => setManageUserId(u.id)}
                          className="h-9 min-w-[92px] px-3 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 disabled:opacity-60"
                        >
                          Manage
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {manageUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[1px] p-4 flex items-center justify-center">
          <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-xl">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Manage Access</h3>
                <p className="text-sm text-slate-500">{manageUser.name || "Unknown User"} - {manageUser.email}</p>
              </div>
              <button
                onClick={() => setManageUserId(null)}
                className="w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
              >
                x
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-2 text-xs">
                <StatusBadge status={manageUser.status} />
                <RoleBadge role={manageUser.role} />
                <InvoiceBadge enabled={manageUser.canAccessInvoiceData} />
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-800 mb-2">Account</p>
                <div className="flex flex-wrap gap-2">
                  {manageUser.status === "PENDING" && (
                    <ActionButton
                      label="Approve User"
                      tone="green"
                      disabled={busyUserId === manageUser.id}
                      onClick={() => runAction(manageUser.id, "APPROVE")}
                    />
                  )}
                  {manageUser.status === "BANNED" && (
                    <ActionButton
                      label="Restore Access"
                      tone="slate"
                      disabled={busyUserId === manageUser.id}
                      onClick={() => runAction(manageUser.id, "UNBAN")}
                    />
                  )}
                  {manageUser.status !== "BANNED" && (
                    <ActionButton
                      label="Block Access"
                      tone="red"
                      disabled={busyUserId === manageUser.id}
                      onClick={() => runAction(manageUser.id, "BAN")}
                    />
                  )}
                </div>
              </div>

              {manageUser.status === "APPROVED" && (
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-sm font-semibold text-slate-800 mb-2">Role</p>
                  <div className="flex flex-wrap gap-2">
                    {manageUser.role === "ADMIN" ? (
                      <ActionButton
                        label="Make Standard User"
                        tone="slate"
                        disabled={busyUserId === manageUser.id}
                        onClick={() => runAction(manageUser.id, "REVOKE_ADMIN")}
                      />
                    ) : (
                      <ActionButton
                        label="Make Admin"
                        tone="blue"
                        disabled={busyUserId === manageUser.id}
                        onClick={() => runAction(manageUser.id, "MAKE_ADMIN")}
                      />
                    )}
                  </div>
                </div>
              )}

              {manageUser.status === "APPROVED" && (
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-sm font-semibold text-slate-800 mb-2">Invoice Access</p>
                  <div className="flex flex-wrap gap-2">
                    {manageUser.canAccessInvoiceData ? (
                      manageUser.role === "ADMIN" ? (
                        <span className="text-xs text-slate-500 font-medium">
                          Admin invoice access is locked by policy.
                        </span>
                      ) : (
                        <ActionButton
                          label="Disable Invoice Access"
                          tone="amber"
                          disabled={busyUserId === manageUser.id}
                          onClick={() => runAction(manageUser.id, "REVOKE_INVOICE_ACCESS")}
                        />
                      )
                    ) : (
                      <ActionButton
                        label="Enable Invoice Access"
                        tone="blue"
                        disabled={busyUserId === manageUser.id}
                        onClick={() => runAction(manageUser.id, "GRANT_INVOICE_ACCESS")}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "amber" | "green" | "red" | "slate" | "blue";
}) {
  const tones: Record<string, string> = {
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    red: "border-red-200 bg-red-50 text-red-700",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
  };

  return (
    <div className={`rounded-xl border px-4 py-3 ${tones[tone]}`}>
      <p className="text-xs font-semibold">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: UserStatus }) {
  if (status === "APPROVED") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Approved
      </span>
    );
  }
  if (status === "PENDING") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md">
        <Clock3 className="w-3.5 h-3.5" />
        Pending
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded-md">
      <XCircle className="w-3.5 h-3.5" />
      Blocked
    </span>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  if (role === "ADMIN") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded-md">
        <ShieldAlert className="w-3.5 h-3.5" />
        Admin
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md">
      <ShieldCheck className="w-3.5 h-3.5" />
      User
    </span>
  );
}

function InvoiceBadge({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md border ${
        enabled
          ? "text-blue-700 bg-blue-50 border-blue-200"
          : "text-slate-600 bg-slate-50 border-slate-200"
      }`}
    >
      {enabled ? "Enabled" : "Disabled"}
    </span>
  );
}

function ActionButton({
  label,
  onClick,
  disabled,
  tone,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone: "green" | "red" | "amber" | "blue" | "slate";
}) {
  const tones: Record<string, string> = {
    green: "bg-emerald-600 text-white hover:bg-emerald-700",
    red: "bg-red-600 text-white hover:bg-red-700",
    amber: "bg-amber-600 text-white hover:bg-amber-700",
    blue: "bg-blue-600 text-white hover:bg-blue-700",
    slate: "bg-slate-800 text-white hover:bg-slate-900",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-60 ${tones[tone]}`}
    >
      {label}
    </button>
  );
}


