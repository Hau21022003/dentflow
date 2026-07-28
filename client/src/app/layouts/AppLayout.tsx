import { Box, Button, Container, Toolbar, Typography } from "@mui/material";
import { Outlet, Link as RouterLink } from "react-router-dom";
import { PATHS } from "../router/paths";

export function AppLayout() {
  return (
    <>
      <Box
        component="header"
        sx={{ bgcolor: "primary.main", color: "primary.contrastText" }}
      >
        <Toolbar>
          <Typography component="div" sx={{ flexGrow: 1, fontWeight: 700 }}>
            DentFlow
          </Typography>
          <Button color="inherit" component={RouterLink} to={PATHS.patients}>
            Bệnh nhân
          </Button>
          <Button color="inherit" component={RouterLink} to={PATHS.login}>
            Đăng nhập mẫu
          </Button>
        </Toolbar>
      </Box>

      <Container component="main" maxWidth="md" sx={{ py: 5 }}>
        <Outlet />
      </Container>
    </>
  );
}
