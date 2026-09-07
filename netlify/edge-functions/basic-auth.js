export default async (request, context) => {
  // Lấy User và Pass từ biến môi trường (sẽ cài đặt trên Netlify sau)
  const expectedUser = Netlify.env.get('AUTH_USER') || 'noiboadmin';
  const expectedPass = Netlify.env.get('AUTH_PASS') || 'matkhau123!';

  const authHeader = request.headers.get('authorization');

  if (authHeader) {
    const [scheme, encoded] = authHeader.split(' ');
    if (scheme.toLowerCase() === 'basic') {
      const decoded = atob(encoded); // Giải mã chuỗi
      const [user, pass] = decoded.split(':');

      // Nếu đúng tài khoản và mật khẩu -> cho phép truy cập web
      if (user === expectedUser && pass === expectedPass) {
        return context.next();
      }
    }
  }

  // Nếu sai hoặc chưa nhập -> Hiển thị cửa sổ yêu cầu đăng nhập
  return new Response('Vui long dang nhap de xem noi dung', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Khu vuc noi bo"',
    },
  });
};
