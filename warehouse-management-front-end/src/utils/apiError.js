export const getApiError = (error) => {
  if (error.response?.data?.error) {
    return error.response.data.error;
  }

  if (error.request) {
    return "Không thể kết nối đến máy chủ. Vui lòng thử lại.";
  }

  return "Đã xảy ra lỗi. Vui lòng thử lại.";
};
