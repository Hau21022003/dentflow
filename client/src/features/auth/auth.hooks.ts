import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authService } from "./auth.service";
import { useAuthStore } from "./auth.store";

const authQueryKey = ["auth"] as const;

export const authQueryKeys = {
  all: authQueryKey,
  me: () => [...authQueryKey, "me"] as const,
};

export function useMeQuery() {
  return useQuery({
    queryKey: authQueryKeys.me(),
    queryFn: authService.getMe,
    retry: false,
  });
}

export function useLoginMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authService.login,
    onSuccess: (user) => {
      queryClient.setQueryData(authQueryKeys.me(), user);
      useAuthStore.getState().setAuthenticatedUser(user);
    },
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authService.logout,
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: authQueryKeys.me() });
      useAuthStore.getState().clearSession();
    },
  });
}
