import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseResumeFile, parseResumeText } from './resumeParser';

const { mockGenerateContent } = vi.hoisted(() => ({ mockGenerateContent: vi.fn() }));

vi.mock('./llmClient', () => ({
  generateContent: mockGenerateContent,
  getLlmMode: () => 'proxy',
}));

// 缺省读不出文字（等同图片 / 扫描件），走把文件交给模型的老路径；转文字路径单独测。
const { mockExtractResumeText } = vi.hoisted(() => ({ mockExtractResumeText: vi.fn() }));
vi.mock('./resumeTextExtractor', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./resumeTextExtractor')>()),
  extractResumeText: mockExtractResumeText,
}));

describe('resumeParser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExtractResumeText.mockResolvedValue(null);
  });

  describe('parseResumeFile', () => {
    it('parses a valid PDF file and returns structured resume', async () => {
      const mockData = {
        basic: {
          name: '张三',
          email: 'zhangsan@example.com',
          phone: '13800138000',
          location: '北京',
        },
        summary: '有5年工作经验',
        education: [
          {
            school: '清华大学',
            degree: '硕士',
            major: '计算机科学',
            gpa: '3.8',
            years: '2018-2020',
          },
        ],
        experience: [
          {
            company: 'Google',
            title: 'Software Engineer',
            period: '2020-2023',
            bullets: ['领导AI项目', '优化系统性能'],
          },
        ],
        skills: {
          hard: ['Python', 'TypeScript'],
          soft: ['Team Leadership'],
          languages: ['Chinese', 'English'],
          tools: ['Git', 'Docker'],
        },
        projects: [
          {
            name: '简历解析系统',
            role: 'Lead',
            bullets: ['设计架构', '实现核心功能'],
            tech: ['Node.js', 'React'],
          },
        ],
      };

      mockGenerateContent.mockResolvedValue({ text: JSON.stringify(mockData) });

      const file = new File(['PDF content'], 'resume.pdf', { type: 'application/pdf' });
      const result = await parseResumeFile(file);

      expect(result.status).toBe('ok');
      expect(result).toHaveProperty('data');
      if (result.status === 'ok') {
        expect(result.data.basic.name).toBe('张三');
        expect(result.data.education).toHaveLength(1);
        expect(result.data.experience[0].company).toBe('Google');
      }
    });

    it('parses a valid image resume file', async () => {
      const mockData = {
        basic: { name: '李四', email: 'lisi@example.com', phone: '', location: '上海' },
        summary: '',
        education: [],
        experience: [
          { company: 'Microsoft', title: 'Manager', period: '2021-2024', bullets: ['Manage team'] },
        ],
        skills: { hard: ['C++'], soft: [], languages: ['English'], tools: [] },
        projects: [],
      };

      mockGenerateContent.mockResolvedValue({ text: JSON.stringify(mockData) });

      const file = new File(['image data'], 'resume.jpg', { type: 'image/jpeg' });
      const result = await parseResumeFile(file);

      expect(result.status).toBe('ok');
      if (result.status === 'ok') {
        expect(result.data.basic.name).toBe('李四');
        expect(result.data.experience[0].title).toBe('Manager');
      }
    });

    it('rejects unsupported file type', async () => {
      const file = new File(['content'], 'resume.exe', { type: 'application/x-msdownload' });
      const result = await parseResumeFile(file);

      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.kind).toBe('unsupported_mime');
        expect(result.message).toContain('Unsupported');
      }
    });

    it('handles empty file', async () => {
      const file = new File([], 'empty.pdf', { type: 'application/pdf' });
      const result = await parseResumeFile(file);

      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.kind).toBe('empty_response');
      }
    });

    it('infers MIME type from filename when file.type is empty', async () => {
      const mockData = {
        basic: { name: 'Test', email: '', phone: '', location: '' },
        summary: '',
        education: [],
        experience: [],
        skills: { hard: [], soft: [], languages: [], tools: [] },
        projects: [],
      };

      mockGenerateContent.mockResolvedValue({ text: JSON.stringify(mockData) });

      const file = new File(['PDF content'], 'resume.pdf');
      Object.defineProperty(file, 'type', { value: '', writable: false });
      const result = await parseResumeFile(file);

      expect(result.status).toBe('ok');
    });

    it('handles Gemini API error', async () => {
      mockGenerateContent.mockRejectedValue(new Error('API quota exceeded'));

      const file = new File(['content'], 'resume.pdf', { type: 'application/pdf' });
      const result = await parseResumeFile(file);

      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.kind).toBe('gemini_error');
        expect(result.message).toContain('quota');
      }
    });

    it('handles schema violation (malformed JSON response)', async () => {
      mockGenerateContent.mockResolvedValue({ text: 'not valid json' });

      const file = new File(['content'], 'resume.pdf', { type: 'application/pdf' });
      const result = await parseResumeFile(file);

      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.kind).toBe('schema_violation');
      }
    });
  });

  describe('parseResumeText', () => {
    it('parses plain text resume and returns structured data', async () => {
      const mockData = {
        basic: {
          name: '王五',
          email: 'wangwu@example.com',
          phone: '13900139000',
          location: '深圳',
        },
        summary: '10年行业经验',
        education: [
          { school: '麻省理工', degree: '博士', major: '人工智能', gpa: '4.0', years: '2015-2020' },
        ],
        experience: [
          {
            company: 'OpenAI',
            title: 'Research Scientist',
            period: '2020-2024',
            bullets: ['发布3篇论文'],
          },
        ],
        skills: {
          hard: ['Machine Learning'],
          soft: [],
          languages: ['Chinese', 'English', 'Japanese'],
          tools: ['PyTorch'],
        },
        projects: [],
      };

      mockGenerateContent.mockResolvedValue({ text: JSON.stringify(mockData) });

      const resumeText = `
        王五
        Contact: wangwu@example.com | 13900139000 | 深圳

        Education:
        麻省理工，博士，人工智能，2015-2020

        Experience:
        OpenAI, Research Scientist, 2020-2024
        - 发布3篇论文
      `;

      const result = await parseResumeText(resumeText);

      expect(result.status).toBe('ok');
      if (result.status === 'ok') {
        expect(result.data.basic.name).toBe('王五');
        expect(result.data.education[0].degree).toBe('博士');
        expect(result.data.experience[0].company).toBe('OpenAI');
      }
    });

    it('rejects empty text', async () => {
      const result = await parseResumeText('');
      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.kind).toBe('empty_response');
      }
    });

    it('rejects whitespace-only text', async () => {
      const result = await parseResumeText('   \n\t  ');
      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.kind).toBe('empty_response');
      }
    });

    it('handles Gemini API error during text parsing', async () => {
      mockGenerateContent.mockRejectedValue(new Error('Rate limit exceeded'));

      const result = await parseResumeText('Some resume text');

      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.kind).toBe('gemini_error');
        expect(result.message).toContain('Rate limit');
      }
    });

    it('handles malformed JSON response in text parsing', async () => {
      mockGenerateContent.mockResolvedValue({ text: '{ invalid json }' });

      const result = await parseResumeText('Valid resume text');

      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.kind).toBe('schema_violation');
      }
    });
  });

  describe('JSON response with markdown code blocks', () => {
    it('strips markdown code blocks from JSON response', async () => {
      const mockData = {
        basic: { name: '赵六', email: 'zhaoliu@example.com', phone: '', location: '' },
        summary: '',
        education: [],
        experience: [],
        skills: { hard: [], soft: [], languages: [], tools: [] },
        projects: [],
      };

      const responseWithMarkdown = `\`\`\`json\n${JSON.stringify(mockData)}\n\`\`\``;

      mockGenerateContent.mockResolvedValue({ text: responseWithMarkdown });

      const result = await parseResumeText('Some resume');

      expect(result.status).toBe('ok');
      if (result.status === 'ok') {
        expect(result.data.basic.name).toBe('赵六');
      }
    });
  });

  describe('text-first upload (works with every provider)', () => {
    const minimal = {
      basic: { name: 'Text', email: '', phone: '', location: '' },
      summary: '',
      education: [],
      experience: [],
      skills: { hard: [], soft: [], languages: [], tools: [] },
      projects: [],
    };

    it('sends extracted text instead of the file when the PDF has text', async () => {
      mockExtractResumeText.mockResolvedValue('Python SQL data analyst intern');
      mockGenerateContent.mockResolvedValue({ text: JSON.stringify(minimal) });

      const file = new File(['%PDF'], 'resume.pdf', { type: 'application/pdf' });
      const result = await parseResumeFile(file);

      expect(result.status).toBe('ok');
      const req = mockGenerateContent.mock.calls[0][0];
      expect(typeof req.contents).toBe('string');
      expect(req.contents).toContain('Python SQL data analyst intern');
      expect(JSON.stringify(req)).not.toContain('inlineData');
    });

    it('falls back to sending the file when extraction throws', async () => {
      mockExtractResumeText.mockRejectedValue(new Error('encrypted'));
      mockGenerateContent.mockResolvedValue({ text: JSON.stringify(minimal) });

      const file = new File(['%PDF'], 'resume.pdf', { type: 'application/pdf' });
      await parseResumeFile(file);

      expect(mockGenerateContent.mock.calls[0][0].contents[0].parts[0].inlineData.mimeType).toBe(
        'application/pdf',
      );
    });

    it('asks for pasted text when a DOCX has no readable text, without calling the model', async () => {
      const file = new File(['x'], 'resume.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const result = await parseResumeFile(file);

      expect(result.status).toBe('error');
      if (result.status === 'error') expect(result.message).toContain('粘贴');
      expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    it('explains image resumes in plain words when the proxy model only reads text', async () => {
      mockGenerateContent.mockRejectedValue(
        new Error('Proxy 400 UNSUPPORTED_INPUT: deepseek 不接受文件或图片输入'),
      );
      const file = new File(['img'], 'resume.png', { type: 'image/png' });
      const result = await parseResumeFile(file);

      expect(result.status).toBe('error');
      if (result.status === 'error') expect(result.message).toContain('只能读文字');
    });
  });
});
