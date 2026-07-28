import { useState, type FormEvent } from "react";
import { Alert, Box, Button, Stack, TextField, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { PATHS } from "../../app/router/paths";

export function CreatePatientPage() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <Stack component="form" noValidate onSubmit={handleSubmit} spacing={3}>
      <Box>
        <Typography component="h1" variant="h4">
          Thêm bệnh nhân
        </Typography>
        <Typography color="text.secondary">
          Form giao diện mẫu; dữ liệu chưa được gửi tới API.
        </Typography>
      </Box>

      {submitted && <Alert severity="info">Mẫu đã nhận submit, nhưng chưa lưu dữ liệu.</Alert>}

      <TextField fullWidth label="Họ và tên" required />
      <TextField fullWidth label="Số điện thoại" required />

      <Stack direction="row" spacing={2}>
        <Button component={RouterLink} to={PATHS.patients} variant="text">
          Hủy
        </Button>
        <Button type="submit" variant="contained">
          Lưu mẫu
        </Button>
      </Stack>
    </Stack>
  );
}
