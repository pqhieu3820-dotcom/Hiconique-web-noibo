export default async (request, context) => {
  // Đọc danh sách "user:pass,user:pass,..." từ biến môi trường AUTH_USERS trên Netlify
  const rawUsers = Netlify.env.get('AUTH_USERS') || 'noiboadmin:matkhau123!';

  const users = {};
  rawUsers.split(',').forEach((pair) => {
    const idx = pair.indexOf(':');
    if (idx === -1) return;
    const user = pair.slice(0, idx).trim();
    const pass = pair.slice(idx + 1).trim();
    if (user) users[user] = pass;
  });

  const authHeader = request.headers.get('authorization');

  if (authHeader) {
    const [scheme, encoded] = authHeader.split(' ');
    if (scheme.toLowerCase() === 'basic') {
      const decoded = atob(encoded); // Giải mã chuỗi
      const sepIdx = decoded.indexOf(':');
      const user = decoded.slice(0, sepIdx);
      const pass = decoded.slice(sepIdx + 1);

      // Nếu user tồn tại và đúng mật khẩu -> cho phép truy cập web
      if (Object.prototype.hasOwnProperty.call(users, user) && users[user] === pass) {
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
