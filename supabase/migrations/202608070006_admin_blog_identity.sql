update public.blogs
set name = '관리자',
    description = '서비스 소식과 주요 안내를 전하는 공식 공지 블로그입니다.',
    updated_at = now()
where slug = 'admin';

update public.users
set nickname = '관리자',
    updated_at = now()
where role = 'ADMIN' and login_id = 'admin';
