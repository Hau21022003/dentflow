import type { PropsWithChildren } from "react";
import { AuthSessionBootstrap } from "./AuthSessionBootstrap";
import { ReactQueryProvider } from "./ReactQueryProvider";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ReactQueryProvider>
      <AuthSessionBootstrap />
      {children}
    </ReactQueryProvider>
  );
}
