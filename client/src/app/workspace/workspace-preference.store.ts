import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * Gợi ý workspace gần nhất trên đúng trình duyệt. Đây chỉ là trạng thái UX:
 * `userId` buộc lựa chọn thuộc về một tài khoản, còn quyền thực tế luôn được
 * kiểm tra lại từ authorization snapshot và route guard.
 */
export type WorkspacePreference = {
  branchSlug: string | null;
  tenantSlug: string;
  userId: string;
  version: 1;
};

type WorkspacePreferenceStore = {
  preference: WorkspacePreference | null;
  /** Xóa gợi ý khi đăng xuất, hết phiên hoặc gợi ý không còn hợp lệ. */
  clearPreference: () => void;
  /**
   * Chỉ ghi localStorage khi lựa chọn thật sự đổi để tránh persist thừa mỗi
   * lần AppLayout render lại theo route.
   */
  setPreference: (preference: WorkspacePreference) => void;
};

/**
 * Store persist cho lựa chọn tenant/branch của thanh điều hướng.
 * Version thuộc payload giúp có thể loại bỏ dữ liệu cũ có chủ đích khi đổi
 * cấu trúc preference trong tương lai.
 */
export const useWorkspacePreferenceStore = create<WorkspacePreferenceStore>()(
  persist(
    (set) => ({
      preference: null,
      clearPreference: () =>
        set((state) =>
          state.preference ? { preference: null } : state,
        ),
      setPreference: (preference) =>
        set((state) => {
          const current = state.preference;
          const isUnchanged =
            current?.branchSlug === preference.branchSlug &&
            current?.tenantSlug === preference.tenantSlug &&
            current?.userId === preference.userId &&
            current?.version === preference.version;

          return isUnchanged ? state : { preference };
        }),
    }),
    {
      name: "dentflow.workspace-preference.v1",
      partialize: (state) => ({ preference: state.preference }),
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);
