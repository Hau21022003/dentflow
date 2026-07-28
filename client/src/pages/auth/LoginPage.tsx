import { Box, Button, Card, CardContent, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { PATHS } from "../../app/router/paths";

export function LoginPage() {
  return (
    <Box
      sx={{
        alignItems: "center",
        display: "flex",
        justifyContent: "center",
        minHeight: "100vh",
        p: 3,
      }}
    >
      <Card sx={{ maxWidth: 440, width: "100%" }}>
        <CardContent sx={{ p: 4 }}>
          <Typography component="h1" variant="h4">
            DentFlow
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3, mt: 1 }}>
            Đây là trang đăng nhập mẫu. Chưa có xác thực hoặc gọi API.
          </Typography>
          <Button
            component={RouterLink}
            fullWidth
            to={PATHS.patients}
            variant="contained"
            color="secondary"
          >
            Mở danh sách bệnh nhân
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}
