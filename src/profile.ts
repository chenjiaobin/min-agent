import fs from 'node:fs';
import path from 'node:path';

const PROFILE_FILE = path.join(process.cwd(), 'profile.json');

export type Profile = {
  fact: string[];
  name?: string;
  city?: string;
  style?: string;
}

// 加载用户档案
export const loadProfile = (): Profile => {
  if (!fs.existsSync(PROFILE_FILE)) return { fact: [] };
  const content = fs.readFileSync(PROFILE_FILE, 'utf-8');
  return JSON.parse(content) as Profile;
}

// 保存用户档案
export const saveProfile = (profile: Profile) => {
  const dir = path.dirname(PROFILE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(PROFILE_FILE, JSON.stringify(profile, null, 2), 'utf-8');
}

// 生成用户档案描述
export const generateProfileDescription = (profile: Profile) => {
  const lines = [
    "# 用户长期偏好（跨会话，权威来源）",
    profile.name ? `- 称呼：${profile.name}` : null,
    profile.city ? `- 常驻/家乡城市：${profile.city}` : null,
    profile.style ? `- 回答风格：${profile.style}` : null,
    ...profile.fact.map((f) => `- 事实：${f}`),
  ].filter(Boolean);

  if (lines.length === 1) {
    lines.push("- （暂无，可通过 remember_preference 写入）");
  }
  return lines.join("\n");
}

export const rememberPreference = (profile: Profile, args: { name?: string, city?: string, style?: string, fact?: string }) => {
  const next: Profile = {
    ...profile,
    fact: [...profile.fact],
  };
  if (args.name) next.name = args.name;
  if (args.city) next.city = args.city;
  if (args.style) next.style = args.style;
  if (args.fact && !next.fact.includes(args.fact)) {
    next.fact.push(args.fact);
  }
  saveProfile(next);
  return next;
}
