import { createHmac, randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { resetDatabase } from "./support/database";
import { E2E_USERS, login } from "./support/login";
import { E2E_TENANT_INVITATION_TOKEN_SECRET } from "./support/tenant-invitation";

const API_URL = "http://127.0.0.1:3001";
const TENANT_SLUG = "test-brightsmile";
const STAFF_ROUTE = `/tenants/${TENANT_SLUG}/staff`;
const BRANCH_STAFF_ROUTE = `/tenants/${TENANT_SLUG}/branches/central/staff`;

type AuthenticatedUser = {
  authorization: {
    tenants: Array<{ tenant: { id: string; slug: string } }>;
  };
};

type StaffInvitation = {
  id: string;
  expiresAt: string;
};

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test("Tenant Admin lists, searches, filters, and pages through staff invitations", async ({
  page,
  request,
}) => {
  await loginTenantAdminApi(request);
  for (let index = 1; index <= 11; index += 1) {
    await createStaffInvitationViaApi(request, {
      email: `staff-list-${String(index).padStart(2, "0")}@dentflow.test`,
      fullName: `Synthetic Staff List ${String(index).padStart(2, "0")}`,
    });
  }

  await login(page, E2E_USERS.tenantAdmin);
  await switchToEnglish(page);
  const initialList = waitForStaffList(
    page,
    (url) => url.searchParams.get("page") === "1" && url.searchParams.get("limit") === "10",
  );
  await page.goto(`/workspace/${TENANT_SLUG}/tenant/staff`);
  await expect(page.getByRole("heading", { name: "Staff management" })).toBeVisible();
  await initialList;
  await expect(page.getByText("Synthetic Staff List 01", { exact: true })).toBeVisible();
  await expect(page.getByText("BrightSmile Test Central", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Invited", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Invitation pending delivery", { exact: true }).first()).toBeVisible();

  const searchRequest = waitForStaffList(
    page,
    (url) => url.searchParams.get("search") === "staff-list-11",
  );
  await page.getByPlaceholder("Search staff name or email...").fill("staff-list-11");
  await searchRequest;
  await expect(page.getByText("Synthetic Staff List 11", { exact: true })).toBeVisible();

  const filterRequest = waitForStaffList(
    page,
    (url) => url.searchParams.get("status") === "INVITED",
  );
  await page.getByRole("combobox", { name: "Filter staff status" }).click();
  await page.getByRole("option", { name: "Invited", exact: true }).click();
  await filterRequest;

  const clearSearchRequest = waitForStaffList(
    page,
    (url) =>
      url.searchParams.get("status") === "INVITED" &&
      !url.searchParams.has("search"),
  );
  await page.getByPlaceholder("Search staff name or email...").fill("");
  await clearSearchRequest;
  const secondPageRequest = waitForStaffList(
    page,
    (url) => url.searchParams.get("page") === "2" && url.searchParams.get("status") === "INVITED",
  );
  await page.getByRole("button", { name: "Go to next page" }).click();
  await secondPageRequest;
});

test("Tenant Admin sends, resends, and revokes an invitation with the required command data", async ({
  page,
}) => {
  await login(page, E2E_USERS.tenantAdmin);
  await switchToEnglish(page);
  await page.goto(`/workspace/${TENANT_SLUG}/tenant/staff`);

  await page.getByRole("button", { name: "Invite staff" }).click();
  const dialog = page.getByRole("dialog", { name: "Invite staff member" });
  await dialog.getByLabel("Email").fill("synthetic-invite@dentflow.test");
  await dialog.getByLabel("Full name").fill("Synthetic Invited Staff");
  await dialog.getByRole("button", { name: "Send invitation" }).click();
  await expect(
    dialog.getByText("Choose at least one active branch for every branch-scoped role."),
  ).toBeVisible();

  await dialog.getByText("BrightSmile Test Central", { exact: true }).click();
  const createRequest = page.waitForRequest(
    (entry) => entry.method() === "POST" && entry.url().endsWith(`${STAFF_ROUTE}/invitations`),
  );
  await dialog.getByRole("button", { name: "Send invitation" }).click();
  const create = await createRequest;
  expect(create.headers()["idempotency-key"]).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  expect(create.postDataJSON()).toEqual({
    email: "synthetic-invite@dentflow.test",
    fullName: "Synthetic Invited Staff",
    assignments: [{ roleCode: "RECEPTIONIST", branchSlugs: ["central"] }],
  });
  await expect(dialog).toHaveCount(0);

  const row = page.getByRole("row").filter({ hasText: "synthetic-invite@dentflow.test" });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Open actions for Synthetic Invited Staff" }).click();
  await page.getByRole("menuitem", { name: "Resend invitation" }).click();
  const resendDialog = page.getByRole("alertdialog", { name: "Resend invitation" });
  const resendRequest = page.waitForRequest(
    (entry) => entry.method() === "POST" && /\/invitations\/[\w-]+\/resend$/.test(new URL(entry.url()).pathname),
  );
  await resendDialog.getByRole("button", { name: "Resend invitation" }).click();
  expect((await resendRequest).headers()["idempotency-key"]).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  await expect(resendDialog).toHaveCount(0);

  const replacementRow = page.getByRole("row").filter({ hasText: "synthetic-invite@dentflow.test" });
  await expect(replacementRow).toBeVisible();
  await replacementRow.getByRole("button", { name: "Open actions for Synthetic Invited Staff" }).click();
  await page.getByRole("menuitem", { name: "Revoke invitation" }).click();
  const revokeDialog = page.getByRole("alertdialog", { name: "Revoke invitation" });
  await revokeDialog.getByRole("button", { name: "Revoke invitation" }).click();
  await expect(revokeDialog.getByText("Enter a reason for this action.")).toBeVisible();
  await revokeDialog.getByLabel("Reason").fill("Synthetic invitation is no longer needed");
  const revokeRequest = page.waitForRequest(
    (entry) => entry.method() === "POST" && /\/invitations\/[\w-]+\/revoke$/.test(new URL(entry.url()).pathname),
  );
  await revokeDialog.getByRole("button", { name: "Revoke invitation" }).click();
  expect((await revokeRequest).postDataJSON()).toEqual({
    reason: "Synthetic invitation is no longer needed",
  });
});

test("Branch Admin manages invitations only through the current branch staff route", async ({
  page,
}) => {
  await login(page, E2E_USERS.branchAdminReceptionist);
  await switchToEnglish(page);
  await page.goto(`/workspace/${TENANT_SLUG}/branches/central/staff`);
  await expect(page.getByRole("heading", { name: "Branch staff" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Disable access" })).toHaveCount(0);

  await page.getByRole("button", { name: "Invite staff" }).click();
  const dialog = page.getByRole("dialog", { name: "Invite staff to branch" });
  await dialog.getByLabel("Email").fill("branch-ui-invite@dentflow.test");
  await dialog.getByLabel("Full name").fill("Branch UI Invite");
  await dialog.getByLabel("Dentist").click();
  const createRequest = page.waitForRequest(
    (entry) =>
      entry.method() === "POST" &&
      new URL(entry.url()).pathname === `${BRANCH_STAFF_ROUTE}/invitations`,
  );
  await dialog.getByRole("button", { name: "Send invitation" }).click();
  expect((await createRequest).postDataJSON()).toEqual({
    email: "branch-ui-invite@dentflow.test",
    fullName: "Branch UI Invite",
    roleCodes: ["RECEPTIONIST", "DENTIST"],
  });
  await expect(dialog).toHaveCount(0);

  const row = page.getByRole("row").filter({ hasText: "branch-ui-invite@dentflow.test" });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Open actions for Branch UI Invite" }).click();
  await page.getByRole("menuitem", { name: "Revoke invitation" }).click();
  const revokeDialog = page.getByRole("alertdialog", { name: "Revoke invitation" });
  await revokeDialog.getByLabel("Reason").fill("Branch staffing changed");
  const revokeRequest = page.waitForRequest(
    (entry) =>
      entry.method() === "POST" &&
      /\/invitations\/[\w-]+\/revoke$/.test(new URL(entry.url()).pathname),
  );
  await revokeDialog.getByRole("button", { name: "Revoke invitation" }).click();
  expect((await revokeRequest).postDataJSON()).toEqual({
    reason: "Branch staffing changed",
  });
});

test("role editing blocks duplicate roles and excludes inactive branch scope", async ({
  page,
  request,
}) => {
  await loginTenantAdminApi(request);
  await deactivateBranchViaApi(request, "central");

  await login(page, E2E_USERS.tenantAdmin);
  await switchToEnglish(page);
  await page.goto(`/workspace/${TENANT_SLUG}/tenant/staff`);
  await page.getByRole("button", { name: "Invite staff" }).click();
  const dialog = page.getByRole("dialog", { name: "Invite staff member" });
  await expect(dialog.getByText("BrightSmile Test Central", { exact: true })).toHaveCount(0);
  await expect(dialog.getByText("BrightSmile Test West", { exact: true })).toBeVisible();

  await dialog.getByRole("button", { name: "Add role" }).click();
  const roleSelectors = dialog.getByLabel("Role");
  await expect(roleSelectors).toHaveCount(2);
  await roleSelectors.nth(1).click();
  await expect(page.getByRole("option", { name: "Receptionist", exact: true })).toHaveAttribute(
    "data-disabled",
    "",
  );
});

test("Tenant Admin grants and revokes roles, then disables and enables a staff member", async ({
  page,
}) => {
  await login(page, E2E_USERS.tenantAdmin);
  await switchToEnglish(page);
  await page.goto(`/workspace/${TENANT_SLUG}/tenant/staff`);

  const row = page.getByRole("row").filter({ hasText: E2E_USERS.branchAdminReceptionist.email });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: /Open actions for/ }).click();
  await page.getByRole("menuitem", { name: "Grant roles" }).click();
  const grantDialog = page.getByRole("dialog", { name: "Grant roles" });
  await grantDialog.getByLabel("Role").click();
  await page.getByRole("option", { name: "Dentist", exact: true }).click();
  await grantDialog.getByText("BrightSmile Test Central", { exact: true }).click();
  const grantRequest = page.waitForRequest(
    (entry) => entry.method() === "POST" && /\/role-assignments$/.test(new URL(entry.url()).pathname),
  );
  await grantDialog.getByRole("button", { name: "Grant roles" }).click();
  expect((await grantRequest).postDataJSON()).toEqual({
    assignments: [{ roleCode: "DENTIST", branchSlugs: ["central"] }],
  });
  await expect(grantDialog).toHaveCount(0);

  await row.getByRole("button", { name: "Revoke Dentist" }).click();
  const revokeRoleDialog = page.getByRole("alertdialog", { name: "Revoke role" });
  await revokeRoleDialog.getByLabel("Reason").fill("Synthetic role cleanup");
  const revokeRoleRequest = page.waitForRequest(
    (entry) => entry.method() === "DELETE" && /\/role-assignments\/[\w-]+$/.test(new URL(entry.url()).pathname),
  );
  await revokeRoleDialog.getByRole("button", { name: "Revoke role" }).click();
  expect((await revokeRoleRequest).postDataJSON()).toEqual({ reason: "Synthetic role cleanup" });

  await row.getByRole("button", { name: /Open actions for/ }).click();
  await page.getByRole("menuitem", { name: "Disable access" }).click();
  const disableDialog = page.getByRole("alertdialog", { name: "Disable staff access" });
  await disableDialog.getByRole("button", { name: "Disable access" }).click();
  await expect(disableDialog.getByText("Enter a reason for this action.")).toBeVisible();
  await disableDialog.getByLabel("Reason").fill("Synthetic access hold");
  const disableRequest = page.waitForRequest(
    (entry) => entry.method() === "POST" && /\/disable$/.test(new URL(entry.url()).pathname),
  );
  await disableDialog.getByRole("button", { name: "Disable access" }).click();
  expect((await disableRequest).postDataJSON()).toEqual({ reason: "Synthetic access hold" });
  await expect(row.getByText("Disabled", { exact: true })).toBeVisible();

  await row.getByRole("button", { name: /Open actions for/ }).click();
  await page.getByRole("menuitem", { name: "Enable access" }).click();
  const enableDialog = page.getByRole("alertdialog", { name: "Enable staff access" });
  await enableDialog.getByLabel("Reason").fill("Synthetic access restored");
  const enableRequest = page.waitForRequest(
    (entry) => entry.method() === "POST" && /\/enable$/.test(new URL(entry.url()).pathname),
  );
  await enableDialog.getByRole("button", { name: "Enable access" }).click();
  expect((await enableRequest).postDataJSON()).toEqual({ reason: "Synthetic access restored" });
  await expect(row.getByText("Active", { exact: true })).toBeVisible();
});

test("staff invitation acceptance validates missing token, new users, matching accounts, and mismatched accounts", async ({
  page,
  request,
}) => {
  await page.goto("/accept-staff-invitation");
  await switchToEnglish(page);
  await expect(page.getByText("Invalid invitation link")).toBeVisible();

  const tenantAdmin = await loginTenantAdminApi(request);
  const newUserInvitation = await createStaffInvitationViaApi(request, {
    email: "new-staff-accept@dentflow.test",
    fullName: "Synthetic New Staff",
  });
  const newUserToken = staffInvitationToken(
    newUserInvitation,
    tenantId(tenantAdmin),
    "new-staff-accept@dentflow.test",
  );
  await page.goto(`/accept-staff-invitation?token=${encodeURIComponent(newUserToken)}`);
  await switchToEnglish(page);
  await page.getByRole("button", { name: "Accept invitation" }).click();
  await expect(page.getByText("Password must be at least 12 characters.")).toBeVisible();
  await page.getByLabel("Password").fill("synthetic-staff-password");
  const acceptNewUser = page.waitForRequest(
    (entry) => entry.method() === "POST" && entry.url().endsWith("/auth/staff-invitations/accept"),
  );
  await page.getByRole("button", { name: "Accept invitation" }).click();
  expect((await acceptNewUser).postDataJSON()).toEqual({
    token: newUserToken,
    password: "synthetic-staff-password",
  });
  await expect(page).toHaveURL(/\/login$/);

  await resetDatabase(request);
  const matchingUser = await loginTenantAdminApi(request);
  const matchingInvitation = await createStaffInvitationViaApi(request, {
    email: E2E_USERS.tenantAdmin.email,
    fullName: "Synthetic Matching Staff",
    roleCode: "DENTIST",
  });
  const matchingToken = staffInvitationToken(
    matchingInvitation,
    tenantId(matchingUser),
    E2E_USERS.tenantAdmin.email,
  );
  await login(page, E2E_USERS.tenantAdmin);
  await page.goto(`/accept-staff-invitation?token=${encodeURIComponent(matchingToken)}`);
  await switchToEnglish(page);
  await expect(page.getByText(E2E_USERS.tenantAdmin.email, { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Accept invitation" }).click();
  await expect(page).toHaveURL(new RegExp(`/workspace/${TENANT_SLUG}/(tenant|branches/central)$`));
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await resetDatabase(request);
  const mismatchUser = await loginTenantAdminApi(request);
  const mismatchInvitation = await createStaffInvitationViaApi(request, {
    email: E2E_USERS.tenantAdmin.email,
    fullName: "Synthetic Mismatch Staff",
    roleCode: "DENTIST",
  });
  const mismatchToken = staffInvitationToken(
    mismatchInvitation,
    tenantId(mismatchUser),
    E2E_USERS.tenantAdmin.email,
  );
  await login(page, E2E_USERS.branchAdminReceptionist);
  await page.goto(`/accept-staff-invitation?token=${encodeURIComponent(mismatchToken)}`);
  await switchToEnglish(page);
  const mismatchResponse = page.waitForResponse(
    (response) => response.request().method() === "POST" && response.url().endsWith("/auth/staff-invitations/accept"),
  );
  await page.getByRole("button", { name: "Accept invitation" }).click();
  expect((await mismatchResponse).status()).toBe(409);
});

async function switchToEnglish(page: Page): Promise<void> {
  const selector = page.getByRole("combobox", {
    name: /Chọn ngôn ngữ|Select language/,
  });
  if (await selector.count()) {
    await selector.click();
    await page.getByRole("option", { name: "EN", exact: true }).click();
  }
}

async function loginTenantAdminApi(request: APIRequestContext): Promise<AuthenticatedUser> {
  const response = await request.post(`${API_URL}/auth/login`, {
    data: E2E_USERS.tenantAdmin,
  });
  await expect(response).toBeOK();
  const result = (await response.json()) as { user: AuthenticatedUser };
  return result.user;
}

async function createStaffInvitationViaApi(
  request: APIRequestContext,
  input: {
    email: string;
    fullName: string;
    roleCode?: "RECEPTIONIST" | "DENTIST";
  },
): Promise<StaffInvitation> {
  const response = await request.post(`${API_URL}${STAFF_ROUTE}/invitations`, {
    headers: { "Idempotency-Key": randomUUID() },
    data: {
      email: input.email,
      fullName: input.fullName,
      assignments: [
        {
          roleCode: input.roleCode ?? "RECEPTIONIST",
          branchSlugs: ["central"],
        },
      ],
    },
  });
  await expect(response).toBeOK();
  return response.json() as Promise<StaffInvitation>;
}

async function deactivateBranchViaApi(
  request: APIRequestContext,
  branchSlug: string,
): Promise<void> {
  const response = await request.post(
    `${API_URL}/tenants/${TENANT_SLUG}/branches/${branchSlug}/deactivate`,
    {
      headers: { "Idempotency-Key": randomUUID() },
      data: { reason: "Synthetic inactive scope validation" },
    },
  );
  await expect(response).toBeOK();
}

function tenantId(user: AuthenticatedUser): string {
  const tenant = user.authorization.tenants.find(
    (authorization) => authorization.tenant.slug === TENANT_SLUG,
  );
  if (!tenant) throw new Error("Expected synthetic BrightSmile authorization.");
  return tenant.tenant.id;
}

function staffInvitationToken(
  invitation: StaffInvitation,
  id: string,
  email: string,
): string {
  const payload = [
    "staff-invitation-v1",
    invitation.id,
    id,
    email.toLowerCase(),
    new Date(invitation.expiresAt).toISOString(),
  ].join(":");
  const signature = createHmac("sha256", E2E_TENANT_INVITATION_TOKEN_SECRET)
    .update(payload)
    .digest("base64url");
  return `${invitation.id}.${signature}`;
}

function waitForStaffList(page: Page, predicate: (url: URL) => boolean) {
  return page.waitForResponse((response) => {
    if (response.request().method() !== "GET") return false;
    const url = new URL(response.url());
    return url.pathname === STAFF_ROUTE && predicate(url);
  });
}
