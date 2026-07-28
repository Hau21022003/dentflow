import { Add } from "@mui/icons-material";
import { Box, Button, Card, CardContent, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { PATHS } from "../../app/router/paths";

export function PatientsListPage() {
  return (
    <Stack spacing={3}>
      <Box sx={{ alignItems: "center", display: "flex", gap: 2, justifyContent: "space-between" }}>
        <Box>
          <Typography component="h1" variant="h4">
            Bệnh nhân
          </Typography>
          <Typography color="text.secondary">
            Trang mẫu cho route danh sách bệnh nhân.
          </Typography>
        </Box>
        <Button component={RouterLink} startIcon={<Add />} to={PATHS.newPatient} variant="contained">
          Thêm bệnh nhân
        </Button>
      </Box>

      <Card variant="outlined">
        <CardContent>
          <Typography sx={{ fontWeight: 600 }}>Chưa có dữ liệu hiển thị</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Khi tích hợp API, danh sách bệnh nhân của tenant đã xác thực sẽ xuất hiện ở đây.
          </Typography>
        </CardContent>
      </Card>
    </Stack>
  );
}
