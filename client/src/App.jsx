import React, { useState, useEffect, useRef } from "react";
import axios from "axios";

const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Set up token header for axios requests
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("wp_publisher_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Intercept responses to handle 401 unauthorized (expired/invalid tokens)
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const hasToken = localStorage.getItem("wp_publisher_token");
      localStorage.removeItem("wp_publisher_token");
      localStorage.removeItem("wp_publisher_user");
      if (hasToken) {
        window.location.reload();
      }
    }
    return Promise.reject(error);
  }
);

function App() {
  // Navigation active tab
  const [activeTab, setActiveTab] = useState("dashboard"); // dashboard, campaign, settings, queue, history

  // Config states
  const [config, setConfig] = useState({
    geminiKey: "",
    openaiKey: "",
    alibabaKey: "",
    leonardoKey: "",
    websites: [],
    customSystemPrompt: "",
  });

  const [selectedWebIds, setSelectedWebIds] = useState([]);
  const [newSite, setNewSite] = useState({ name: "", url: "", user: "", password: "" });
  const [testingSiteId, setTestingSiteId] = useState(null);
  const [editingSiteId, setEditingSiteId] = useState(null);
  const [productImage, setProductImage] = useState("");
  const [imagePreview, setImagePreview] = useState("");

  // SEO Dental Article Optimizer & Compositor States
  const [seoTitle, setSeoTitle] = useState("");
  const [seoContent, setSeoContent] = useState("");
  const [seoKeywords, setSeoKeywords] = useState("");
  const [seoCategory, setSeoCategory] = useState("Tin tức");
  const [seoProductImage, setSeoProductImage] = useState("");
  const [seoProductPreview, setSeoProductPreview] = useState("");
  const [logo1, setLogo1] = useState("");
  const [logo1Preview, setLogo1Preview] = useState("");
  const [logo2, setLogo2] = useState("");
  const [logo2Preview, setLogo2Preview] = useState("");
  const [seoBacklinks, setSeoBacklinks] = useState([
    { url: "https://maxdent.vn", anchorText: "Nha khoa MaxDent", linkType: "brand" }
  ]);
  const [hasLogos, setHasLogos] = useState(true);
  const [logoPosition, setLogoPosition] = useState("top-left");
  const [logoScale, setLogoScale] = useState(15);
  const [logo1Position, setLogo1Position] = useState("top-left");
  const [logo1Scale, setLogo1Scale] = useState(12);
  const [logo2Position, setLogo2Position] = useState("top-right");
  const [logo2Scale, setLogo2Scale] = useState(15);
  const [imageSize, setImageSize] = useState("1200x800");
  const [numImages, setNumImages] = useState("auto");
  const [seoModel, setSeoModel] = useState("qwen");
  const [seoImageModel, setSeoImageModel] = useState("unsplash");
  const [seoIncludeImages, setSeoIncludeImages] = useState(true);

  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isGeneratingArticle, setIsGeneratingArticle] = useState(false);
  const [isPublishingSingle, setIsPublishingSingle] = useState(false);
  const [seoResult, setSeoResult] = useState(null);
  const [seoPublishResult, setSeoPublishResult] = useState(null);
  const [seoError, setSeoError] = useState(null);

  // Post parameters states
  const [params, setParams] = useState({
    topics: "",
    keywords: "",
    tone: "Chuyên nghiệp",
    language: "Tiếng Việt",
    postStatus: "draft",
    researchModel: "qwen",
    writingModel: "qwen",
    imageModel: "unsplash",
    cooldown: 15,
    useAdvancedSeo: true,
    useMultiSiteVariation: true,
    includeImages: true,
  });

  // Task running states
  const [isPublishing, setIsPublishing] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [taskStatus, setTaskStatus] = useState("idle");
  const [steps, setSteps] = useState([]);
  const [taskTopics, setTaskTopics] = useState([]);
  const [taskWebsites, setTaskWebsites] = useState([]);
  const [taskProgress, setTaskProgress] = useState({});
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Connection testing states (for inline adding)
  const [isTestingNew, setIsTestingNew] = useState(false);
  const [testNewResult, setTestNewResult] = useState(null);
  const [isTestingApis, setIsTestingApis] = useState(false);
  const [apiTestResults, setApiTestResults] = useState(null);

  // RSS Scenario States
  const [rssScenarioResults, setRssScenarioResults] = useState(null);
  const [isRunningRssScenario, setIsRunningRssScenario] = useState(false);
  const [rssError, setRssError] = useState(null);
  const [rssUrlInput, setRssUrlInput] = useState("");
  const [rssTargetWebsite, setRssTargetWebsite] = useState("");

  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem("wp_publisher_user");
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (e) {
      return null;
    }
  });

  // Auth views states
  const [authMode, setAuthMode] = useState("login"); // login, register
  const [authUsername, setAuthUsername] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authConfirmPassword, setAuthConfirmPassword] = useState("");
  const [authError, setAuthError] = useState(null);
  const [authMessage, setAuthMessage] = useState(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Activation screen states
  const [activationCode, setActivationCode] = useState("");
  const [activationError, setActivationError] = useState(null);
  const [activationMessage, setActivationMessage] = useState(null);
  const [isActivating, setIsActivating] = useState(false);
  const [isResendingCode, setIsResendingCode] = useState(false);

  // Admin Panel states
  const [adminUsers, setAdminUsers] = useState([]);
  const [isAdminLoadingUsers, setIsAdminLoadingUsers] = useState(false);
  const [adminSmtpEmail, setAdminSmtpEmail] = useState("");
  const [adminSmtpPassword, setAdminSmtpPassword] = useState("");
  const [adminSmtpMessage, setAdminSmtpMessage] = useState(null);
  const [isSavingSmtp, setIsSavingSmtp] = useState(false);

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    if (!authUsername || !authPassword) {
      setAuthError("Vui lòng điền đầy đủ tên đăng nhập/email và mật khẩu!");
      return;
    }
    
    setIsAuthenticating(true);
    setAuthError(null);
    setAuthMessage(null);
    
    try {
      const res = await axios.post(`${BACKEND_URL}/api/auth/login`, {
        usernameOrEmail: authUsername,
        password: authPassword
      });
      
      const { token, user: loggedUser } = res.data;
      localStorage.setItem("wp_publisher_token", token);
      localStorage.setItem("wp_publisher_user", JSON.stringify(loggedUser));
      setUser(loggedUser);
      setAuthUsername("");
      setAuthPassword("");
    } catch (err) {
      setAuthError(err.response?.data?.error || err.message);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleRegister = async (e) => {
    if (e) e.preventDefault();
    if (!authUsername || !authEmail || !authPassword || !authConfirmPassword) {
      setAuthError("Vui lòng nhập đầy đủ các trường thông tin!");
      return;
    }
    
    if (authPassword !== authConfirmPassword) {
      setAuthError("Mật khẩu xác nhận không khớp!");
      return;
    }
    
    setIsAuthenticating(true);
    setAuthError(null);
    setAuthMessage(null);
    
    try {
      const res = await axios.post(`${BACKEND_URL}/api/auth/register`, {
        username: authUsername,
        email: authEmail,
        password: authPassword
      });
      
      setAuthMessage(res.data.message);
      setTimeout(() => {
        setAuthMode("login");
        setAuthPassword("");
        setAuthConfirmPassword("");
        setAuthError(null);
        setAuthMessage(null);
      }, 4000);
    } catch (err) {
      setAuthError(err.response?.data?.error || err.message);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("wp_publisher_token");
    localStorage.removeItem("wp_publisher_user");
    setUser(null);
    setActiveTab("dashboard");
  };

  const handleActivateAccount = async (e) => {
    if (e) e.preventDefault();
    if (!activationCode || activationCode.trim() === "") {
      setActivationError("Vui lòng nhập mã kích hoạt 6 chữ số!");
      return;
    }
    
    setIsActivating(true);
    setActivationError(null);
    setActivationMessage(null);
    
    try {
      const res = await axios.post(`${BACKEND_URL}/api/auth/activate`, {
        code: activationCode
      });
      
      setActivationMessage(res.data.message);
      const updatedUser = { ...user, status: "active" };
      localStorage.setItem("wp_publisher_user", JSON.stringify(updatedUser));
      setUser(updatedUser);
    } catch (err) {
      setActivationError(err.response?.data?.error || err.message);
    } finally {
      setIsActivating(false);
    }
  };

  const handleResendActivationCode = async () => {
    setIsResendingCode(true);
    setActivationError(null);
    setActivationMessage(null);
    
    try {
      const res = await axios.post(`${BACKEND_URL}/api/auth/resend-code`);
      setActivationMessage(res.data.message);
    } catch (err) {
      setActivationError(err.response?.data?.error || err.message);
    } finally {
      setIsResendingCode(false);
    }
  };

  const fetchAdminUsers = async () => {
    if (user?.role !== "admin") return;
    setIsAdminLoadingUsers(true);
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/users`);
      setAdminUsers(res.data);
    } catch (err) {
      console.error("Failed to fetch admin users:", err);
    } finally {
      setIsAdminLoadingUsers(false);
    }
  };

  const handleToggleUserStatus = async (userId, currentStatus) => {
    const nextStatus = currentStatus === "active" ? "suspended" : "active";
    const confirmMsg = nextStatus === "suspended" 
      ? "Bạn có chắc chắn muốn khóa tài khoản này? Tài khoản sẽ không thể truy cập phần mềm." 
      : "Mở khóa cho tài khoản này tiếp tục sử dụng phần mềm?";
      
    if (!window.confirm(confirmMsg)) return;
    
    try {
      await axios.post(`${BACKEND_URL}/api/admin/users/${userId}/status`, {
        status: nextStatus
      });
      fetchAdminUsers();
    } catch (err) {
      alert("Lỗi cập nhật trạng thái tài khoản: " + (err.response?.data?.error || err.message));
    }
  };

  const handleSaveSmtpSettings = async (e) => {
    if (e) e.preventDefault();
    if (!adminSmtpEmail || !adminSmtpPassword) {
      alert("Vui lòng điền email và mật khẩu ứng dụng Gmail!");
      return;
    }
    
    setIsSavingSmtp(true);
    setAdminSmtpMessage(null);
    
    try {
      const res = await axios.post(`${BACKEND_URL}/api/admin/smtp`, {
        smtpEmail: adminSmtpEmail,
        smtpPassword: adminSmtpPassword
      });
      setAdminSmtpMessage({ success: true, message: res.data.message });
      setConfig(prev => ({ ...prev, smtpEmail: adminSmtpEmail, smtpPassword: adminSmtpPassword }));
    } catch (err) {
      setAdminSmtpMessage({ success: false, message: err.response?.data?.error || err.message });
    } finally {
      setIsSavingSmtp(false);
    }
  };

  useEffect(() => {
    if (user && activeTab === "admin") {
      fetchAdminUsers();
    }
  }, [activeTab, user]);

  const handleRunRssScenario = async () => {
    setIsRunningRssScenario(true);
    setRssScenarioResults(null);
    setRssError(null);
    try {
      const res = await axios.post(`${BACKEND_URL}/api/run-rss-scenario`, {
        rssUrl: rssUrlInput,
        websiteId: rssTargetWebsite || undefined,
        geminiKey: config.geminiKey,
        alibabaKey: config.alibabaKey,
        openaiKey: config.openaiKey
      });
      setRssScenarioResults(res.data.steps);
      fetchHistory();
    } catch (err) {
      setRssError(err.response?.data?.error || err.message);
      if (err.response?.data?.steps) {
        setRssScenarioResults(err.response.data.steps);
      }
    } finally {
      setIsRunningRssScenario(false);
    }
  };

  // History state
  const [history, setHistory] = useState([]);
  
  // History filters
  const [searchFilter, setSearchFilter] = useState("");
  const [siteFilter, setSiteFilter] = useState("");

  const consoleBoxRef = useRef(null);

  // Load config and history on mount if user is logged in
  useEffect(() => {
    if (user) {
      fetchConfig();
      fetchHistory();
    }
  }, [user]);

  // Initialize SEO Editor inputs with defaults from config when config is loaded
  useEffect(() => {
    if (config) {
      if (config.logo1) {
        setLogo1(config.logo1);
        setLogo1Preview(config.logo1);
      } else {
        setLogo1("");
        setLogo1Preview("");
      }
      if (config.logo2) {
        setLogo2(config.logo2);
        setLogo2Preview(config.logo2);
      } else {
        setLogo2("");
        setLogo2Preview("");
      }
      if (config.logoPosition) setLogoPosition(config.logoPosition);
      if (config.logoScale !== undefined) setLogoScale(config.logoScale);
      setLogo1Position(config.logo1Position || config.logoPosition || "top-left");
      setLogo1Scale(config.logo1Scale !== undefined ? config.logo1Scale : (config.logoScale !== undefined ? config.logoScale : 12));
      setLogo2Position(config.logo2Position || config.logoPosition || "top-right");
      setLogo2Scale(config.logo2Scale !== undefined ? config.logo2Scale : (config.logoScale !== undefined ? config.logoScale : 15));
      if (config.imageSize) setImageSize(config.imageSize);
      if (config.hasLogos !== undefined) setHasLogos(config.hasLogos);
      if (config.backlinks && config.backlinks.length > 0) {
        setSeoBacklinks(config.backlinks);
      }
      if (config.smtpEmail) setAdminSmtpEmail(config.smtpEmail);
      if (config.smtpPassword) setAdminSmtpPassword(config.smtpPassword);
    }
  }, [config]);

  // Scroll to bottom of console container only when new steps are logged
  useEffect(() => {
    if (consoleBoxRef.current) {
      consoleBoxRef.current.scrollTop = consoleBoxRef.current.scrollHeight;
    }
  }, [steps]);

  // Polling for task progress
  useEffect(() => {
    let intervalId;
    if (isPublishing && activeTaskId) {
      intervalId = setInterval(async () => {
        try {
          const res = await axios.get(`${BACKEND_URL}/api/tasks/${activeTaskId}`);
          const data = res.data;
          
          setSteps(data.steps || []);
          setTaskStatus(data.status);
          setTaskTopics(data.topics || []);
          setTaskWebsites(data.websites || []);
          setTaskProgress(data.progress || {});
          
          if (data.status === "completed") {
            setIsPublishing(false);
            setResult(data.result);
            fetchHistory();
            clearInterval(intervalId);
          } else if (data.status === "failed") {
            setIsPublishing(false);
            setErrorMsg(data.error);
            clearInterval(intervalId);
          }
        } catch (err) {
          console.error("Error polling task progress:", err);
        }
      }, 1500);
    }
    return () => clearInterval(intervalId);
  }, [isPublishing, activeTaskId]);

  const fetchConfig = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/config`);
      const data = res.data;
      setConfig(data);
      
      if (data.websites && Array.isArray(data.websites)) {
        setSelectedWebIds(data.websites.map(w => w.id));
      }
    } catch (err) {
      console.error("Failed to load config from server:", err);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/history`);
      setHistory(res.data || []);
    } catch (err) {
      console.error("Failed to load history:", err);
    }
  };

  const handleConfigChange = (e) => {
    const { name, value } = e.target;
    setConfig((prev) => ({ ...prev, [name]: value }));
  };

  const handleParamChange = (e) => {
    const { name, value } = e.target;
    setParams((prev) => ({ ...prev, [name]: value }));
  };

  const saveConfigToServer = async (updatedConfig) => {
    try {
      const res = await axios.post(`${BACKEND_URL}/api/config`, updatedConfig);
      if (res.data && res.data.config) {
        setConfig(res.data.config);
      }
    } catch (err) {
      console.error("Failed to auto-save config:", err);
    }
  };

  const handleSaveConfig = async () => {
    try {
      const res = await axios.post(`${BACKEND_URL}/api/config`, config);
      if (res.data && res.data.config) {
        setConfig(res.data.config);
      }
      alert("💾 Cấu hình đã được lưu thành công!");
    } catch (err) {
      alert("❌ Lỗi khi lưu cấu hình: " + err.message);
    }
  };

  const handleTestApiKeys = async () => {
    setIsTestingApis(true);
    setApiTestResults(null);
    try {
      const res = await axios.post(`${BACKEND_URL}/api/test-api-keys`, {
        geminiKey: config.geminiKey,
        openaiKey: config.openaiKey,
        alibabaKey: config.alibabaKey,
        leonardoKey: config.leonardoKey
      });
      setApiTestResults(res.data);
    } catch (err) {
      alert("Lỗi khi kiểm tra kết nối API: " + (err.response?.data?.error || err.message));
    } finally {
      setIsTestingApis(false);
    }
  };

  const handleStartEditWebsite = (site) => {
    setEditingSiteId(site.id);
    setNewSite({
      name: site.name,
      url: site.url,
      user: site.user,
      password: site.password
    });
    setTestNewResult(null);
  };

  const handleCancelEdit = () => {
    setEditingSiteId(null);
    setNewSite({ name: "", url: "", user: "", password: "" });
    setTestNewResult(null);
  };



  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("❌ Dung lượng file ảnh phải nhỏ hơn 5MB!");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setProductImage(reader.result);
      setImagePreview(URL.createObjectURL(file));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setProductImage("");
    if (imagePreview && imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }
    setImagePreview("");
  };



  const handleSeoProductImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("❌ Dung lượng file ảnh phải nhỏ hơn 5MB!");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setSeoProductImage(reader.result);
      setSeoProductPreview(URL.createObjectURL(file));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveSeoProductImage = () => {
    setSeoProductImage("");
    if (seoProductPreview && seoProductPreview.startsWith("blob:")) {
      URL.revokeObjectURL(seoProductPreview);
    }
    setSeoProductPreview("");
  };

  const handleLogoChange = (num, e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("❌ Dung lượng logo phải nhỏ hơn 2MB!");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (num === 1) {
        setLogo1(reader.result);
        setLogo1Preview(URL.createObjectURL(file));
      } else {
        setLogo2(reader.result);
        setLogo2Preview(URL.createObjectURL(file));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = (num) => {
    if (num === 1) {
      setLogo1("");
      if (logo1Preview && logo1Preview.startsWith("blob:")) {
        URL.revokeObjectURL(logo1Preview);
      }
      setLogo1Preview("");
    } else {
      setLogo2("");
      if (logo2Preview && logo2Preview.startsWith("blob:")) {
        URL.revokeObjectURL(logo2Preview);
      }
      setLogo2Preview("");
    }
  };

  const handleConfigLogoChange = (num, e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("❌ Dung lượng logo phải nhỏ hơn 2MB!");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setConfig(prev => ({
        ...prev,
        [num === 1 ? "logo1" : "logo2"]: reader.result
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveConfigLogo = (num) => {
    setConfig(prev => ({
      ...prev,
      [num === 1 ? "logo1" : "logo2"]: ""
    }));
  };

  const handleAddConfigBacklink = () => {
    setConfig(prev => ({
      ...prev,
      backlinks: [...(prev.backlinks || []), { url: "", anchorText: "", linkType: "brand" }]
    }));
  };

  const handleRemoveConfigBacklink = (index) => {
    setConfig(prev => ({
      ...prev,
      backlinks: (prev.backlinks || []).filter((_, idx) => idx !== index)
    }));
  };

  const handleConfigBacklinkChange = (index, field, value) => {
    setConfig(prev => ({
      ...prev,
      backlinks: (prev.backlinks || []).map((item, idx) => 
        idx === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const handleAddBacklink = () => {
    setSeoBacklinks(prev => [...prev, { url: "", anchorText: "", linkType: "brand" }]);
  };

  const handleRemoveBacklink = (index) => {
    setSeoBacklinks(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleBacklinkChange = (index, field, value) => {
    setSeoBacklinks(prev => prev.map((item, idx) => 
      idx === index ? { ...item, [field]: value } : item
    ));
  };

  const handleGenerateSeoArticle = async () => {
    if (!seoTitle.trim()) {
      alert("Vui lòng nhập Tiêu đề bài viết để AI soạn thảo!");
      return;
    }
    setIsGeneratingArticle(true);
    setSeoError(null);
    try {
      const res = await axios.post(`${BACKEND_URL}/api/generate-seo-article`, {
        title: seoTitle,
        keywords: seoKeywords,
        category: seoCategory,
        model: seoModel,
        openaiKey: config.openaiKey,
        alibabaKey: config.alibabaKey
      });
      setSeoContent(res.data.content);
    } catch (err) {
      setSeoError(err.response?.data?.error || err.message);
    } finally {
      setIsGeneratingArticle(false);
    }
  };

  const handleOptimizePost = async (e) => {
    if (e) e.preventDefault();
    if (!seoTitle.trim()) {
      alert("Vui lòng nhập Tiêu đề bài viết!");
      return;
    }
    if (!seoContent.trim()) {
      alert("Vui lòng nhập Nội dung hoặc click nút tự sinh bằng AI!");
      return;
    }

    setIsOptimizing(true);
    setSeoResult(null);
    setSeoPublishResult(null);
    setSeoError(null);

    // Filter out empty backlinks
    const cleanLinks = seoBacklinks.filter(link => link.url.trim() !== "" && link.anchorText.trim() !== "");

    try {
      const res = await axios.post(`${BACKEND_URL}/api/optimize-post`, {
        title: seoTitle,
        content: seoContent,
        keywords: seoKeywords,
        category: seoCategory,
        productImage: seoProductImage,
        logo1,
        logo2,
        backlinks: cleanLinks,
        logoPosition,
        logoScale,
        logo1Position,
        logo1Scale,
        logo2Position,
        logo2Scale,
        hasLogos,
        imageSize,
        numImages,
        model: seoModel,
        imageModel: seoImageModel,
        includeImages: seoIncludeImages,
        openaiKey: config.openaiKey,
        alibabaKey: config.alibabaKey,
        leonardoKey: config.leonardoKey
      });
      setSeoResult(res.data);
    } catch (err) {
      setSeoError(err.response?.data?.error || err.message);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handlePublishSingle = async () => {
    if (!seoResult) {
      alert("Vui lòng click 'Xem trước & Tối ưu bài viết' trước khi xuất bản!");
      return;
    }
    if (selectedWebIds.length === 0) {
      alert("Vui lòng chọn ít nhất một website tại cột Danh sách Website hoặc tab Cấu Hình!");
      return;
    }

    setIsPublishingSingle(true);
    setSeoPublishResult(null);
    setSeoError(null);

    const selectedWebsites = (config.websites || []).filter(w => selectedWebIds.includes(w.id));

    try {
      const res = await axios.post(`${BACKEND_URL}/api/publish-single`, {
        title: seoTitle,
        content: seoResult.optimizedHtml,
        postStatus: params.postStatus,
        selectedWebsites,
        images: seoResult.images
      });
      setSeoPublishResult(res.data);
      alert("🎉 Đăng bài viết lên website thành công! Xem kết quả ở bảng báo cáo.");
      fetchHistory();
    } catch (err) {
      setSeoError(err.response?.data?.error || err.message);
    } finally {
      setIsPublishingSingle(false);
    }
  };

  const handleAddWebsite = () => {
    if (!newSite.name.trim() || !newSite.url.trim() || !newSite.user.trim() || !newSite.password.trim()) {
      alert("Vui lòng nhập đầy đủ thông tin website!");
      return;
    }

    let updatedWebsites;
    if (editingSiteId) {
      updatedWebsites = (config.websites || []).map(w => 
        w.id === editingSiteId ? { ...w, ...newSite } : w
      );
      setEditingSiteId(null);
    } else {
      const siteId = "site_" + Date.now();
      updatedWebsites = [...(config.websites || []), { ...newSite, id: siteId }];
      setSelectedWebIds(prev => [...prev, siteId]);
    }

    const updatedConfig = { ...config, websites: updatedWebsites };
    
    setConfig(updatedConfig);
    setNewSite({ name: "", url: "", user: "", password: "" });
    setTestNewResult(null);
    saveConfigToServer(updatedConfig);
  };

  const handleDeleteWebsite = (id) => {
    if (editingSiteId === id) {
      setEditingSiteId(null);
      setNewSite({ name: "", url: "", user: "", password: "" });
    }
    if (!window.confirm("Bạn có chắc chắn muốn xóa website này khỏi cấu hình?")) return;
    const updatedWebsites = (config.websites || []).filter(w => w.id !== id);
    const updatedConfig = { ...config, websites: updatedWebsites };
    
    setConfig(updatedConfig);
    setSelectedWebIds(prev => prev.filter(wId => wId !== id));
    saveConfigToServer(updatedConfig);
  };

  const handleToggleSelectWebsite = (id) => {
    setSelectedWebIds(prev => 
      prev.includes(id) ? prev.filter(wId => wId !== id) : [...prev, id]
    );
  };

  const handleTestSiteConnection = async (site) => {
    setTestingSiteId(site.id);
    try {
      const res = await axios.post(`${BACKEND_URL}/api/test-connection`, {
        url: site.url,
        user: site.user,
        password: site.password
      });
      alert(`✅ Kết nối thành công tới ${site.name}!\n${res.data.message}`);
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message;
      alert(`❌ Kết nối thất bại tới ${site.name}!\nLỗi: ${errMsg}`);
    } finally {
      setTestingSiteId(null);
    }
  };

  const handleTestNewConnection = async () => {
    if (!newSite.url.trim() || !newSite.user.trim() || !newSite.password.trim()) {
      alert("Vui lòng nhập URL, Username và Password để kiểm tra kết nối!");
      return;
    }
    setIsTestingNew(true);
    setTestNewResult(null);
    try {
      const res = await axios.post(`${BACKEND_URL}/api/test-connection`, {
        url: newSite.url,
        user: newSite.user,
        password: newSite.password
      });
      setTestNewResult({ success: true, message: res.data.message });
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message;
      setTestNewResult({ success: false, message: errMsg });
    } finally {
      setIsTestingNew(false);
    }
  };

  const handlePublish = async (e) => {
    e.preventDefault();
    const parsedTopics = params.topics.split("\n").map(t => t.trim()).filter(t => t !== "");
    if (parsedTopics.length === 0) {
      alert("Vui lòng nhập ít nhất một chủ đề bài viết!");
      return;
    }
    if (selectedWebIds.length === 0) {
      alert("Vui lòng chọn ít nhất một website để đăng bài!");
      return;
    }
    if (!config.geminiKey?.trim() && !config.openaiKey.trim() && !config.alibabaKey.trim()) {
      alert("Vui lòng cấu hình API Key cho Gemini, OpenAI hoặc Alibaba Cloud!");
      return;
    }

    setIsPublishing(true);
    setTaskStatus("running");
    setSteps([]);
    setTaskTopics(parsedTopics);
    
    const selectedWebsites = (config.websites || []).filter(w => selectedWebIds.includes(w.id));
    setTaskWebsites(selectedWebsites);

    const initialProgress = {};
    parsedTopics.forEach((_, tIdx) => {
      selectedWebsites.forEach(site => {
        initialProgress[`${tIdx}_${site.id}`] = { status: "pending", result: null, error: null };
      });
    });
    setTaskProgress(initialProgress);
    setResult(null);
    setErrorMsg(null);
    
    // Switch to Queue monitor tab automatically
    setActiveTab("queue");

    try {
      const res = await axios.post(`${BACKEND_URL}/api/publish`, {
        ...params,
        topics: parsedTopics,
        selectedWebsites,
        geminiKey: config.geminiKey,
        openaiKey: config.openaiKey,
        alibabaKey: config.alibabaKey,
        leonardoKey: config.leonardoKey,
        customSystemPrompt: config.customSystemPrompt,
        productImage: productImage
      });
      setActiveTaskId(res.data.taskId);
    } catch (err) {
      setIsPublishing(false);
      setTaskStatus("failed");
      setErrorMsg(err.response?.data?.error || err.message);
    }
  };

  const handleCopyLink = (link) => {
    navigator.clipboard.writeText(link);
    alert("📋 Đã copy link vào bộ nhớ đệm!");
  };

  // Helper calculation for Dashboard Statistics
  const getDashboardStats = () => {
    const totalWebsites = config.websites ? config.websites.length : 0;
    const totalPublished = history.length;
    const successRate = totalPublished > 0 ? 100 : 0; // Simple fallback
    return { totalWebsites, totalPublished, successRate };
  };
  const stats = getDashboardStats();

  // Helper chart generator
  const getChartData = () => {
    const dates = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString("vi-VN", { day: "numeric", month: "numeric" });
      dates[dateStr] = 0;
    }
    
    history.forEach(item => {
      try {
        const datePart = item.timestamp.split(",")[0].trim();
        const [d, m] = datePart.split("/");
        const dateStr = `${d}/${m}`;
        if (dates[dateStr] !== undefined) {
          dates[dateStr]++;
        }
      } catch (e) {
        // ignore date parsing mismatch
      }
    });
    return Object.entries(dates).map(([date, count]) => ({ date, count }));
  };
  const chartData = getChartData();
  const maxCount = Math.max(...chartData.map(d => d.count), 1);

  // Filters calculation
  const filteredHistory = history.filter(item => {
    const matchSearch = item.title.toLowerCase().includes(searchFilter.toLowerCase()) || 
                        item.topic.toLowerCase().includes(searchFilter.toLowerCase());
    const matchSite = siteFilter === "" || item.websiteUrl === siteFilter;
    return matchSearch && matchSite;
  });

  // Target websites select details
  const activeSelectedSitesCount = (config.websites || []).filter(w => selectedWebIds.includes(w.id)).length;
  
  // Topic Lines counter helper
  const getTopicLinesCount = () => {
    return params.topics.split("\n").map(t => t.trim()).filter(t => t !== "").length;
  };

  // Queue progress calculation
  const totalJobs = taskTopics.length * taskWebsites.length;
  const completedJobs = Object.values(taskProgress).filter(
    p => p.status === "completed" || p.status === "failed"
  ).length;
  const progressPercent = totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0;

  // Placeholder SVG Generator
  const renderPlaceholderImage = () => (
    <div style={{ position: "relative", width: "100%", height: "160px", overflow: "hidden", borderRadius: "8px" }}>
      <svg className="history-card-img" viewBox="0 0 320 160" style={{ width: "100%", height: "100%", display: "block" }}>
        <rect width="100%" height="100%" fill="url(#cardGrad)" />
        <circle cx="160" cy="80" r="45" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="6" />
        <path d="M140 80C140 70 145 60 160 60C175 60 180 70 180 80C180 95 160 105 160 115" stroke="rgba(255,255,255,0.7)" strokeWidth="6" fill="none" strokeLinecap="round" />
        <circle cx="160" cy="130" r="4" fill="rgba(255,255,255,0.7)" />
        <defs>
          <linearGradient id="cardGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.8" />
          </linearGradient>
        </defs>
      </svg>
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "rgba(255,255,255,0.9)",
        fontSize: "13px",
        fontWeight: "bold"
      }}>
        NHA KHOA SEO
      </div>
    </div>
  );

  if (!user) {
    return (
      <div className="auth-page notranslate" translate="no">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-header-logo">WP</div>
            <h1>WP Publisher Pro</h1>
            <p>Hệ thống tự động biên tập và đăng bài SEO đa kênh</p>
          </div>
          
          <div className="auth-tabs">
            <button 
              className={`auth-tab ${authMode === "login" ? "active" : ""}`}
              onClick={() => { setAuthMode("login"); setAuthError(null); setAuthMessage(null); }}
            >
              Đăng nhập
            </button>
            <button 
              className={`auth-tab ${authMode === "register" ? "active" : ""}`}
              onClick={() => { setAuthMode("register"); setAuthError(null); setAuthMessage(null); }}
            >
              Đăng ký
            </button>
          </div>

          {authError && <div className="auth-error">⚠️ {authError}</div>}
          {authMessage && <div className="auth-success">✓ {authMessage}</div>}

          {authMode === "login" ? (
            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div className="form-group">
                <label>Tên đăng nhập hoặc Email</label>
                <input 
                  type="text" 
                  value={authUsername} 
                  onChange={(e) => setAuthUsername(e.target.value)} 
                  placeholder="Nhập username hoặc email..." 
                  required
                />
              </div>
              <div className="form-group">
                <label>Mật khẩu</label>
                <input 
                  type="password" 
                  value={authPassword} 
                  onChange={(e) => setAuthPassword(e.target.value)} 
                  placeholder="••••••••" 
                  required
                />
              </div>
              <button className="btn" type="submit" disabled={isAuthenticating} style={{ marginTop: "0.5rem" }}>
                {isAuthenticating ? "Đang xác thực..." : "Đăng Nhập"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div className="form-group">
                <label>Tên đăng nhập (Username)</label>
                <input 
                  type="text" 
                  value={authUsername} 
                  onChange={(e) => setAuthUsername(e.target.value)} 
                  placeholder="Nhập tên viết liền..." 
                  required
                />
              </div>
              <div className="form-group">
                <label>Địa chỉ Email</label>
                <input 
                  type="email" 
                  value={authEmail} 
                  onChange={(e) => setAuthEmail(e.target.value)} 
                  placeholder="email@example.com" 
                  required
                />
              </div>
              <div className="form-group">
                <label>Mật khẩu</label>
                <input 
                  type="password" 
                  value={authPassword} 
                  onChange={(e) => setAuthPassword(e.target.value)} 
                  placeholder="••••••••" 
                  required
                />
              </div>
              <div className="form-group">
                <label>Xác nhận mật khẩu</label>
                <input 
                  type="password" 
                  value={authConfirmPassword} 
                  onChange={(e) => setAuthConfirmPassword(e.target.value)} 
                  placeholder="••••••••" 
                  required
                />
              </div>
              <button className="btn" type="submit" disabled={isAuthenticating} style={{ marginTop: "0.5rem" }}>
                {isAuthenticating ? "Đang xử lý..." : "Đăng Ký Tài Khoản"}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  if (user.status === "suspended") {
    return (
      <div className="auth-page notranslate" translate="no">
        <div className="auth-card lock-screen">
          <div className="lock-icon-wrapper suspended">🔒</div>
          <h2>Tài Khoản Bị Khóa</h2>
          <p style={{ color: "var(--color-text-secondary)", margin: "1rem 0" }}>
            Tài khoản của bạn đã bị khóa bởi Quản trị viên của hệ thống. Vui lòng liên hệ với admin để được giải đáp hoặc khôi phục quyền truy cập.
          </p>
          <button className="btn btn-secondary" onClick={handleLogout} style={{ width: "100%", marginTop: "1rem" }}>
            Đăng xuất tài khoản
          </button>
        </div>
      </div>
    );
  }

  if (user.status === "pending") {
    return (
      <div className="auth-page notranslate" translate="no">
        <div className="auth-card lock-screen">
          <div className="lock-icon-wrapper pending">✉️</div>
          <h2>Kích Hoạt Tài Khoản</h2>
          <p style={{ color: "var(--color-text-secondary)", margin: "0.5rem 0" }}>
            Một mã kích hoạt gồm 6 chữ số đã được gửi tới địa chỉ email <strong>{user.email}</strong>.
          </p>
          <p style={{ fontSize: "0.8rem", color: "#64748b" }}>
            Nhập mã kích hoạt vào ô bên dưới để mở khóa tất cả các chức năng.
          </p>
          
          {activationError && <div className="auth-error" style={{ marginTop: "1rem" }}>⚠️ {activationError}</div>}
          {activationMessage && <div className="auth-success" style={{ marginTop: "1rem" }}>✓ {activationMessage}</div>}

          <form onSubmit={handleActivateAccount}>
            <div className="activation-code-row">
              <input 
                type="text" 
                maxLength="6"
                value={activationCode} 
                onChange={(e) => setActivationCode(e.target.value)} 
                className="activation-input"
                placeholder="000000"
                required
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <button className="btn" type="submit" disabled={isActivating}>
                {isActivating ? "Đang kích hoạt..." : "Kích Hoạt Tài Khoản 🚀"}
              </button>
              <button 
                className="btn btn-secondary" 
                type="button" 
                onClick={handleResendActivationCode} 
                disabled={isResendingCode}
              >
                {isResendingCode ? "Đang gửi lại..." : "Gửi lại mã qua email 📩"}
              </button>
              <button className="btn btn-secondary" type="button" onClick={handleLogout} style={{ color: "var(--danger-text)" }}>
                Thoát đăng nhập 🚪
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout notranslate" translate="no">
      {/* Sidebar Navigation */}
      <div className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">WP</div>
          <h2>Publisher Pro</h2>
        </div>

        <div className="sidebar-menu">
          <button 
            className={`menu-item ${activeTab === "dashboard" ? "active" : ""}`}
            onClick={() => setActiveTab("dashboard")}
          >
            📊 Tổng Quan Dashboard
          </button>
          <button 
            className={`menu-item ${activeTab === "campaign" ? "active" : ""}`}
            onClick={() => setActiveTab("campaign")}
          >
            🚀 Soạn Campaign Mới
          </button>
          <button 
            className={`menu-item ${activeTab === "seo-editor" ? "active" : ""}`}
            onClick={() => setActiveTab("seo-editor")}
          >
            ✍️ Soạn Bài Viết SEO
          </button>
          <button 
            className={`menu-item ${activeTab === "rss-scenario" ? "active" : ""}`}
            onClick={() => setActiveTab("rss-scenario")}
          >
            📡 Kịch Bản RSS 4-Bước
          </button>
          <button 
            className={`menu-item ${activeTab === "settings" ? "active" : ""}`}
            onClick={() => setActiveTab("settings")}
          >
            ⚙️ Cấu Hình & Website
          </button>
          <button 
            className={`menu-item ${activeTab === "queue" ? "active" : ""}`}
            onClick={() => setActiveTab("queue")}
          >
            💻 Tiến Trình
            {isPublishing && <span className="status-badge running" style={{ marginLeft: "auto", fontSize: "0.6rem", padding: "0.1rem 0.4rem" }}>Run</span>}
          </button>
          <button 
            className={`menu-item ${activeTab === "history" ? "active" : ""}`}
            onClick={() => setActiveTab("history")}
          >
            📚 Lịch Sử Đăng Bài
          </button>
          {user.role === "admin" && user.email === "haison20032812@gmail.com" && (
            <button 
              className={`menu-item ${activeTab === "admin" ? "active" : ""}`}
              onClick={() => setActiveTab("admin")}
            >
              👥 Quản Lý Thành Viên
            </button>
          )}
        </div>

        <div className="user-info-section">
          <div className="user-avatar">{user.username.substring(0, 2).toUpperCase()}</div>
          <div className="user-details">
            <span className="user-name">{user.username}</span>
            <span className="user-role-badge">{user.role === "admin" ? "Quản trị viên" : "Thành viên"}</span>
          </div>
          <button className="logout-btn" onClick={handleLogout} title="Đăng xuất">
            🚪
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="main-content">
        <div className="main-container">
          
          {/* TAB 1: DASHBOARD OVERVIEW */}
          {activeTab === "dashboard" && (
            <>
              <div className="tab-header">
                <div>
                  <h1>📊 Tổng Quan Dashboard</h1>
                  <p>Báo cáo chỉ số hoạt động và phân tích bài đăng đa kênh</p>
                </div>
              </div>

              {/* Stats metric row */}
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon blue">🌐</div>
                  <div className="stat-details">
                    <span className="stat-value">{stats.totalWebsites}</span>
                    <span className="stat-label">Website Liên Kết</span>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon green">📝</div>
                  <div className="stat-details">
                    <span className="stat-value">{stats.totalPublished}</span>
                    <span className="stat-label">Bài Đăng Hoàn Thành</span>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon purple">⚡</div>
                  <div className="stat-details">
                    <span className="stat-value">{stats.successRate}%</span>
                    <span className="stat-label">Tỷ Lệ Thành Công</span>
                  </div>
                </div>
              </div>

              {/* Graphical Analysis */}
              <div className="panel">
                <h3 className="panel-title">📈 Thống kê xuất bản bài viết trong 7 ngày gần đây</h3>
                <div style={{ 
                  marginTop: "1.5rem", 
                  padding: "1.5rem 1rem", 
                  display: "flex", 
                  justifyContent: "space-between", 
                  alignItems: "flex-end", 
                  height: "180px",
                  background: "#f8fafc",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0"
                }}>
                  {chartData.map((d, idx) => {
                    const barHeightPercent = (d.count / maxCount) * 100;
                    return (
                      <div 
                        key={d.date || idx} 
                        style={{ 
                          display: "flex", 
                          flexDirection: "column", 
                          alignItems: "center", 
                          flex: 1,
                          height: "100%",
                          justifyContent: "flex-end"
                        }}
                      >
                        {/* Value */}
                        <span style={{ 
                          fontSize: "11px", 
                          fontWeight: "bold", 
                          color: "#4f46e5", 
                          marginBottom: "6px" 
                        }}>
                          {d.count}
                        </span>
                        
                        {/* Bar Container (Track) */}
                        <div style={{ 
                          width: "28px", 
                          height: "100px", 
                          backgroundColor: "#e2e8f0", 
                          borderRadius: "6px", 
                          position: "relative",
                          overflow: "hidden"
                        }}>
                          {/* Bar Fill */}
                          <div style={{ 
                            position: "absolute",
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: `${barHeightPercent}%`,
                            background: "linear-gradient(180deg, #4f46e5 0%, #3b82f6 100%)",
                            borderRadius: "6px",
                            transition: "height 0.3s ease"
                          }} />
                        </div>
                        
                        {/* Axis label */}
                        <span style={{ 
                          fontSize: "10px", 
                          fontWeight: "600", 
                          color: "#64748b", 
                          marginTop: "8px" 
                        }}>
                          {d.date}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Quick Start Card */}
              <div className="panel" style={{ background: "linear-gradient(135deg, #e0e7ff 0%, #e0f2fe 100%)", border: "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h3 style={{ margin: "0 0 0.5rem 0", color: "#1e1b4b", fontSize: "1.25rem", fontWeight: "800" }}>🚀 Bắt đầu chiến dịch viết bài SEO mới</h3>
                    <p style={{ margin: 0, color: "#312e81", fontSize: "0.9rem" }}>Nhập hàng loạt chủ đề bài đăng nha khoa, hệ thống tự biên soạn và đăng đa website trong chớp mắt.</p>
                  </div>
                  <button className="btn" onClick={() => setActiveTab("campaign")}>
                    Bắt đầu Soạn thảo ➜
                  </button>
                </div>
              </div>
            </>
          )}

          {/* TAB 2: CAMPAIGN EDITOR */}
          {activeTab === "campaign" && (
            <>
              <div className="tab-header">
                <div>
                  <h1>🚀 Soạn Chiến Dịch Viết Bài Mới</h1>
                  <p>Tạo các nội dung SEO tự động và cấu hình tham số xuất bản</p>
                </div>
              </div>

              <form onSubmit={handlePublish} className="panel">
                <h3 className="panel-title">📝 Thiết Lập Bài Viết & Chủ Đề</h3>
                <p className="panel-desc">Hệ thống sẽ chạy song song các tiến trình lập dàn ý và đăng bài.</p>

                <div className="form-group">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <label>Danh sách chủ đề cần viết (Mỗi dòng một bài)</label>
                    <span className="status-badge idle" style={{ fontSize: "0.75rem", padding: "0.15rem 0.5rem" }}>
                      Đã nhập: {getTopicLinesCount()} chủ đề
                    </span>
                  </div>
                  <textarea
                    name="topics"
                    value={params.topics}
                    onChange={handleParamChange}
                    placeholder="Mỗi dòng là một chủ đề bài viết. Ví dụ:&#10;- Trụ Implant Paltop của Mỹ có tốt không?&#10;- Quy trình cấy ghép Implant tiêu chuẩn Y khoa diễn ra như thế nào&#10;- Niềng răng Invisalign có đau không? So sánh với niềng mắc cài"
                    rows="6"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Từ khóa SEO lồng ghép (Keywords - Các từ khóa cách nhau bằng dấu phẩy)</label>
                  <textarea
                    name="keywords"
                    value={params.keywords}
                    onChange={handleParamChange}
                    placeholder="Ví dụ: cấy ghép implant, nha khoa thẩm mỹ, chăm sóc răng miệng"
                    rows="2"
                  />
                </div>

                {/* Product Image Upload Section */}
                <div className="form-group" style={{ border: "1px dashed var(--color-border)", borderRadius: "8px", padding: "1.25rem", backgroundColor: "#f8fafc" }}>
                  <label style={{ display: "block", marginBottom: "0.5rem" }}>🖼️ Minh Họa Sản Phẩm Thực Tế (Không bắt buộc)</label>
                  {!imagePreview ? (
                    <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1.5rem 1rem", border: "1px dashed #cbd5e1", borderRadius: "6px", backgroundColor: "#ffffff", cursor: "pointer" }}>
                      <span style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>📁</span>
                      <span style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)" }}>Kéo thả hoặc click để tải lên ảnh sản phẩm</span>
                      <span style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.25rem" }}>Định dạng PNG, JPG, JPEG (Tối đa 5MB)</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        style={{ position: "absolute", opacity: 0, width: "100%", height: "100%", top: 0, left: 0, cursor: "pointer" }}
                        title=""
                      />
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "0.75rem", backgroundColor: "#ffffff", borderRadius: "6px", border: "1px solid var(--color-border)" }}>
                      <div style={{ position: "relative", width: "80px", height: "80px", borderRadius: "6px", overflow: "hidden", border: "1px solid var(--color-border)" }}>
                        <img src={imagePreview} alt="Product Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", flex: 1 }}>
                        <span style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--color-text)" }}>
                          Đã tải ảnh lên thành công
                        </span>
                        <span style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)" }}>Sản phẩm này sẽ được GPT-4o Vision phân tích và lồng ghép vẽ bối cảnh bằng DALL-E 3.</span>
                        <button type="button" className="btn-action-small delete" onClick={handleRemoveImage} style={{ width: "fit-content", marginTop: "0.25rem" }}>
                          🗑️ Hủy chọn hình ảnh
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label>Tông giọng viết bài (Tone)</label>
                    <select name="tone" value={params.tone} onChange={handleParamChange}>
                      <option value="Chuyên nghiệp">Chuyên nghiệp (Khuyên dùng cho Nha khoa)</option>
                      <option value="Thân thiện, Gần gũi">Thân thiện, Gần gũi</option>
                      <option value="Hài hước, Thú vị">Hài hước, Thú vị</option>
                      <option value="Thuyết phục, Bán hàng">Thuyết phục, Bán hàng</option>
                      <option value="Chia sẻ kiến thức">Chia sẻ kiến thức chuyên môn</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Trạng thái bài đăng trên WP (Status)</label>
                    <select name="postStatus" value={params.postStatus} onChange={handleParamChange}>
                      <option value="draft">Bản nháp (Draft - Nên chọn để kiểm tra trước)</option>
                      <option value="publish">Xuất bản trực tiếp (Publish)</option>
                    </select>
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label>Mô hình Nghiên cứu (Research)</label>
                    <select name="researchModel" value={params.researchModel} onChange={handleParamChange}>
                      <option value="qwen">Qwen (qwen-plus - Viết cực tốt bằng tiếng Việt)</option>
                      <option value="openai">OpenAI (gpt-4o-mini)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Mô hình Viết bài (Writing)</label>
                    <select name="writingModel" value={params.writingModel} onChange={handleParamChange}>
                      <option value="qwen">Qwen (qwen-plus - Đảm bảo tự nhiên & tốc độ)</option>
                      <option value="openai">OpenAI (gpt-4o)</option>
                    </select>
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label>Mô hình Hình ảnh (Image)</label>
                    <select name="imageModel" value={params.imageModel || "unsplash"} onChange={handleParamChange}>
                      <option value="unsplash">Unsplash Stock (Chọn lọc nha khoa chuyên nghiệp)</option>
                      <option value="dalle3">OpenAI DALL-E 3 (Cần API Key OpenAI)</option>
                      <option value="leonardo">Leonardo.ai (Tạo hình ảnh chất lượng cao)</option>
                      <option value="pollinations">Pollinations.ai (AI vẽ miễn phí - Không cần Key)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Thời gian giãn cách giữa các bài (giây)</label>
                    <input
                      type="number"
                      name="cooldown"
                      min="0"
                      max="300"
                      value={params.cooldown}
                      onChange={handleParamChange}
                      placeholder="15"
                    />
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label>Ngôn ngữ</label>
                    <input
                      type="text"
                      name="language"
                      value={params.language}
                      onChange={handleParamChange}
                      placeholder="Tiếng Việt"
                    />
                  </div>
                  <div className="form-group"></div>
                </div>

                {/* Advanced SEO Toggle & Settings */}
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1rem" }}>
                  <div style={{ padding: "1rem", backgroundColor: "#e0f2fe", borderRadius: "8px", border: "1px solid #bae6fd", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                      <span style={{ fontWeight: "700", fontSize: "0.9rem", color: "#0369a1" }}>
                        ✨ Kích hoạt Tối ưu hóa SEO & Đóng dấu Thương hiệu nâng cao
                      </span>
                      <span style={{ fontSize: "0.75rem", color: "#0e7490" }}>
                        Hệ thống sẽ tự động viết bài từ danh sách tiêu đề, tự động chèn backlinks, ghép ảnh sản phẩm và đóng dấu Logo 1 & 2 đã cấu hình tại tab <strong>Cấu hình & Website</strong>.
                      </span>
                    </div>
                    <input 
                      type="checkbox" 
                      name="useAdvancedSeo"
                      checked={params.useAdvancedSeo !== undefined ? params.useAdvancedSeo : true}
                      onChange={(e) => setParams(prev => ({ ...prev, useAdvancedSeo: e.target.checked }))}
                      style={{ width: "20px", height: "20px", cursor: "pointer" }}
                    />
                  </div>

                  <div style={{ padding: "1rem", backgroundColor: "#f0fdf4", borderRadius: "8px", border: "1px solid #bbf7d0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                      <span style={{ fontWeight: "700", fontSize: "0.9rem", color: "#166534" }}>
                        🔄 Đa dạng hóa nội dung (Tạo bài viết độc bản cho từng website)
                      </span>
                      <span style={{ fontSize: "0.75rem", color: "#15803d" }}>
                        Nếu bạn chọn nhiều website, hệ thống sẽ tự động viết các tiêu đề và nội dung bài viết khác biệt cho từng trang để tránh trùng lặp nội dung (Duplicate Content) SEO.
                      </span>
                    </div>
                    <input 
                      type="checkbox" 
                      name="useMultiSiteVariation"
                      checked={params.useMultiSiteVariation !== undefined ? params.useMultiSiteVariation : true}
                      onChange={(e) => setParams(prev => ({ ...prev, useMultiSiteVariation: e.target.checked }))}
                      style={{ width: "20px", height: "20px", cursor: "pointer" }}
                    />
                  </div>

                  <div style={{ padding: "1rem", backgroundColor: "#fff7ed", borderRadius: "8px", border: "1px solid #ffedd5", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                      <span style={{ fontWeight: "700", fontSize: "0.9rem", color: "#c2410c" }}>
                        🖼️ Đăng kèm hình ảnh minh họa cho bài viết
                      </span>
                      <span style={{ fontSize: "0.75rem", color: "#9a3412" }}>
                        Khi bật, hệ thống sẽ tự động thiết kế hình ảnh chèn vào bài. Khi tắt, bài viết sẽ chỉ đăng văn bản thuần túy.
                      </span>
                    </div>
                    <input 
                      type="checkbox" 
                      name="includeImages"
                      checked={params.includeImages !== undefined ? params.includeImages : true}
                      onChange={(e) => setParams(prev => ({ ...prev, includeImages: e.target.checked }))}
                      style={{ width: "20px", height: "20px", cursor: "pointer" }}
                    />
                  </div>
                </div>

                {/* Confirm target websites selected */}
                <div style={{ padding: "0.75rem 1rem", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid var(--color-border)", fontSize: "0.85rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>🎯 Website nhắm mục tiêu đã chọn: <strong>{activeSelectedSitesCount} website</strong></span>
                  <button type="button" className="btn-action-small" onClick={() => setActiveTab("settings")}>
                    Thay đổi web ⚙️
                  </button>
                </div>

                <button className="btn" type="submit" disabled={isPublishing} style={{ padding: "1rem", fontSize: "1rem", marginTop: "0.5rem" }}>
                  {isPublishing ? (
                    <>
                      <div className="spinner"></div> Đang Khởi Tạo Đăng Hàng Loạt...
                    </>
                  ) : (
                    <>🚀 Viết & Đăng Bài Hàng Loạt</>
                  )}
                </button>
              </form>
            </>
          )}

          {/* TAB: SEO DENTAL ARTICLE OPTIMIZER */}
          {activeTab === "seo-editor" && (
            <>
              <div className="tab-header">
                <div>
                  <h1>✍️ Biên Tập & Tối Ưu Bài Viết SEO Nha Khoa</h1>
                  <p>Tối ưu hóa hình ảnh thương hiệu, quản lý backlink tự nhiên và thiết kế ảnh sản phẩm</p>
                </div>
              </div>

              {seoError && (
                <div className="connection-test-result test-error" style={{ whiteSpace: "pre-wrap" }}>
                  <strong>Lỗi:</strong> {seoError}
                </div>
              )}

              <div className="seo-editor-container" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
                
                {/* Column 1: Config & Fields */}
                <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                  
                  {/* Panel A: Post Meta & Keywords */}
                  <div className="panel">
                    <h3 className="panel-title">📝 Metadata & Từ khóa</h3>
                    <div className="form-group">
                      <label>Tiêu đề bài viết SEO (H1)</label>
                      <input 
                        type="text" 
                        value={seoTitle}
                        onChange={(e) => setSeoTitle(e.target.value)}
                        placeholder="Ví dụ: Quy trình cấy ghép Implant có đau không? Giá bao nhiêu?"
                        required
                      />
                    </div>
                    <div className="grid-2">
                      <div className="form-group">
                        <label>Từ khóa SEO lồng ghép</label>
                        <input 
                          type="text"
                          value={seoKeywords}
                          onChange={(e) => setSeoKeywords(e.target.value)}
                          placeholder="Ví dụ: trồng răng implant, bảng giá implant"
                        />
                      </div>
                      <div className="form-group">
                        <label>Chuyên mục bài viết</label>
                        <input 
                          type="text"
                          value={seoCategory}
                          onChange={(e) => setSeoCategory(e.target.value)}
                          placeholder="Tin tức"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Panel B: Branded Image uploads */}
                  <div className="panel">
                    <h3 className="panel-title">🖼️ Cấu hình hình ảnh & Thương hiệu</h3>
                    
                    {/* Product Image */}
                    <div className="form-group" style={{ border: "1px dashed var(--color-border)", borderRadius: "8px", padding: "1rem", backgroundColor: "#f8fafc" }}>
                      <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: "600" }}>Ảnh sản phẩm nha khoa (Không bắt buộc)</label>
                      {!seoProductPreview ? (
                        <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1rem", border: "1px dashed #cbd5e1", borderRadius: "6px", backgroundColor: "#ffffff", cursor: "pointer" }}>
                          <span style={{ fontSize: "1.25rem" }}>📁</span>
                          <span style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)" }}>Tải lên ảnh sản phẩm của bạn</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleSeoProductImageChange}
                            style={{ position: "absolute", opacity: 0, width: "100%", height: "100%", top: 0, left: 0, cursor: "pointer" }}
                            title=""
                          />
                        </div>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                          <img src={seoProductPreview} alt="Product" style={{ width: "50px", height: "50px", objectFit: "cover", borderRadius: "4px" }} />
                          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                            <span style={{ fontSize: "0.75rem", fontWeight: "bold" }}>Đã chọn ảnh sản phẩm</span>
                            <button type="button" className="btn-action-small delete" onClick={handleRemoveSeoProductImage} style={{ width: "fit-content", marginTop: "0.15rem" }}>
                              🗑️ Xóa
                            </button>
                          </div>
                        </div>
                      )}


                      
                      {/* Checkbox: Include Images in Single Editor */}
                      <div style={{ marginTop: "1rem", padding: "0.75rem", backgroundColor: "#fff7ed", borderRadius: "6px", border: "1px solid #ffedd5", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                          <span style={{ fontWeight: "700", fontSize: "0.85rem", color: "#c2410c" }}>
                            🖼️ Đăng kèm hình ảnh minh họa
                          </span>
                          <span style={{ fontSize: "0.7rem", color: "#9a3412" }}>
                            Bật để AI tự động thiết kế hình ảnh chèn vào bài. Tắt để chỉ xuất bản bài viết dạng chữ.
                          </span>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={seoIncludeImages} 
                          onChange={(e) => setSeoIncludeImages(e.target.checked)} 
                          style={{ width: "18px", height: "18px", cursor: "pointer" }}
                        />
                      </div>
                    </div>

                    {/* Logos Upload */}
                    <div className="grid-2" style={{ marginTop: "1rem" }}>
                      <div className="form-group" style={{ border: "1px dashed var(--color-border)", borderRadius: "8px", padding: "0.75rem", backgroundColor: "#f8fafc" }}>
                        <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: "600" }}>Logo công ty 1</label>
                        {!logo1Preview ? (
                          <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0.5rem", border: "1px dashed #cbd5e1", borderRadius: "6px", backgroundColor: "#ffffff" }}>
                            <span style={{ fontSize: "1rem" }}>➕ Logo 1</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleLogoChange(1, e)}
                              style={{ position: "absolute", opacity: 0, width: "100%", height: "100%", top: 0, left: 0, cursor: "pointer" }}
                              title=""
                            />
                          </div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <img src={logo1Preview} alt="Logo 1" style={{ width: "40px", height: "40px", objectFit: "contain", borderRadius: "2px" }} />
                            <button type="button" className="btn-action-small delete" onClick={() => handleRemoveLogo(1)}>Xóa</button>
                          </div>
                        )}
                      </div>

                      <div className="form-group" style={{ border: "1px dashed var(--color-border)", borderRadius: "8px", padding: "0.75rem", backgroundColor: "#f8fafc" }}>
                        <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: "600" }}>Logo công ty 2</label>
                        {!logo2Preview ? (
                          <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0.5rem", border: "1px dashed #cbd5e1", borderRadius: "6px", backgroundColor: "#ffffff" }}>
                            <span style={{ fontSize: "1rem" }}>➕ Logo 2</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleLogoChange(2, e)}
                              style={{ position: "absolute", opacity: 0, width: "100%", height: "100%", top: 0, left: 0, cursor: "pointer" }}
                              title=""
                            />
                          </div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <img src={logo2Preview} alt="Logo 2" style={{ width: "40px", height: "40px", objectFit: "contain", borderRadius: "2px" }} />
                            <button type="button" className="btn-action-small delete" onClick={() => handleRemoveLogo(2)}>Xóa</button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Logo Overlay Settings */}
                    <div style={{ marginTop: "1rem", padding: "0.75rem", backgroundColor: "#f1f5f9", borderRadius: "6px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                        <label style={{ fontWeight: "600", fontSize: "0.8rem" }}>Đóng dấu Logo lên ảnh</label>
                        <input 
                          type="checkbox" 
                          checked={hasLogos} 
                          onChange={(e) => setHasLogos(e.target.checked)} 
                          style={{ width: "16px", height: "16px", cursor: "pointer" }}
                        />
                      </div>
                      
                      {hasLogos && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "0.5rem" }}>
                          {/* Logo 1 Override Settings */}
                          <div style={{ borderTop: "1px solid #cbd5e1", paddingTop: "0.75rem" }}>
                            <span style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--color-text)", display: "block", marginBottom: "0.5rem" }}>Cấu hình Logo 1</span>
                            <div className="grid-2">
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={{ fontSize: "0.75rem" }}>Vị trí dán Logo 1</label>
                                <select value={logo1Position} onChange={(e) => setLogo1Position(e.target.value)} style={{ padding: "0.25rem", fontSize: "0.8rem" }}>
                                  <option value="top-left">Trên trái</option>
                                  <option value="top-right">Trên phải</option>
                                </select>
                              </div>
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={{ fontSize: "0.75rem" }}>Kích thước Logo 1 ({logo1Scale}%)</label>
                                <input 
                                  type="range" 
                                  min="8" 
                                  max="30" 
                                  value={logo1Scale}
                                  onChange={(e) => setLogo1Scale(parseInt(e.target.value))}
                                  style={{ width: "100%", height: "6px", cursor: "pointer" }}
                                  />
                              </div>
                            </div>
                          </div>

                          {/* Logo 2 Override Settings */}
                          <div style={{ borderTop: "1px solid #cbd5e1", paddingTop: "0.75rem" }}>
                            <span style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--color-text)", display: "block", marginBottom: "0.5rem" }}>Cấu hình Logo 2</span>
                            <div className="grid-2">
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={{ fontSize: "0.75rem" }}>Vị trí dán Logo 2</label>
                                <select value={logo2Position} onChange={(e) => setLogo2Position(e.target.value)} style={{ padding: "0.25rem", fontSize: "0.8rem" }}>
                                  <option value="top-left">Trên trái</option>
                                  <option value="top-right">Trên phải</option>
                                </select>
                              </div>
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={{ fontSize: "0.75rem" }}>Kích thước Logo 2 ({logo2Scale}%)</label>
                                <input 
                                  type="range" 
                                  min="8" 
                                  max="30" 
                                  value={logo2Scale}
                                  onChange={(e) => setLogo2Scale(parseInt(e.target.value))}
                                  style={{ width: "100%", height: "6px", cursor: "pointer" }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Panel C: Backlinks configuration */}
                  <div className="panel">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                      <h3 className="panel-title" style={{ margin: 0 }}>🔗 Danh sách Backlink SEO</h3>
                      <button type="button" className="btn-action-small" onClick={handleAddBacklink}>➕ Thêm Link</button>
                    </div>
                    
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      {seoBacklinks.map((link, idx) => (
                        <div key={idx} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end", backgroundColor: "#f8fafc", padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--color-border)" }}>
                          <div style={{ flex: 2, display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                            <label style={{ fontSize: "0.7rem", color: "#64748b" }}>Địa chỉ URL</label>
                            <input 
                              type="url" 
                              value={link.url}
                              onChange={(e) => handleBacklinkChange(idx, "url", e.target.value)}
                              placeholder="https://maxdent.vn"
                              style={{ padding: "0.35rem", fontSize: "0.8rem", width: "100%", boxSizing: "border-box" }}
                            />
                          </div>
                          <div style={{ flex: 1.5, display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                            <label style={{ fontSize: "0.7rem", color: "#64748b" }}>Anchor Text</label>
                            <input 
                              type="text" 
                              value={link.anchorText}
                              onChange={(e) => handleBacklinkChange(idx, "anchorText", e.target.value)}
                              placeholder="MaxDent"
                              style={{ padding: "0.35rem", fontSize: "0.8rem", width: "100%", boxSizing: "border-box" }}
                            />
                          </div>
                          <div style={{ flex: 1.2, display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                            <label style={{ fontSize: "0.7rem", color: "#64748b" }}>Loại link</label>
                            <select 
                              value={link.linkType}
                              onChange={(e) => handleBacklinkChange(idx, "linkType", e.target.value)}
                              style={{ padding: "0.35rem", fontSize: "0.8rem", width: "100%" }}
                            >
                              <option value="brand">Thương hiệu</option>
                              <option value="keyword_main">Từ khóa chính</option>
                              <option value="keyword_sub">Từ khóa phụ</option>
                              <option value="naked">URL trần</option>
                              <option value="cta">CTA tự nhiên</option>
                            </select>
                          </div>
                          <button type="button" className="btn-action-small delete" onClick={() => handleRemoveBacklink(idx)} style={{ height: "30px", padding: "0.25rem 0.5rem" }}>🗑️</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Column 2: Article Editor & Preview */}
                <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                  
                  {/* Panel D: Editor */}
                  <div className="panel">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                      <h3 className="panel-title" style={{ margin: 0 }}>✍️ Nội dung bài viết</h3>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <select value={seoModel} onChange={(e) => setSeoModel(e.target.value)} style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }} title="Mô hình viết bài">
                          <option value="qwen">Viết: Qwen</option>
                          <option value="openai">Viết: GPT-4o</option>
                        </select>
                        <select value={seoImageModel} onChange={(e) => setSeoImageModel(e.target.value)} style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }} title="Mô hình hình ảnh">
                          <option value="unsplash">Ảnh: Unsplash</option>
                          <option value="dalle3">Ảnh: DALL-E 3</option>
                          <option value="leonardo">Ảnh: Leonardo</option>
                          <option value="pollinations">Ảnh: Pollinations</option>
                        </select>
                        <button 
                          type="button" 
                          className="btn-action-small" 
                          onClick={handleGenerateSeoArticle}
                          disabled={isGeneratingArticle}
                        >
                          {isGeneratingArticle ? "⌛ Đang soạn..." : "✨ AI Tự Viết Bài"}
                        </button>
                      </div>
                    </div>

                    <div className="form-group">
                      <textarea
                        value={seoContent}
                        onChange={(e) => setSeoContent(e.target.value)}
                        placeholder="Nhập nội dung bài viết HTML thô tại đây, hoặc bấm nút 'AI Tự Viết Bài' để hệ thống tự soạn thảo cấu trúc bài viết nha khoa..."
                        rows="12"
                        style={{ fontFamily: "monospace", fontSize: "0.85rem" }}
                      />
                    </div>

                    {/* Image Gen options */}
                    <div className="grid-2" style={{ backgroundColor: "#f8fafc", padding: "0.75rem", borderRadius: "6px", border: "1px solid var(--color-border)" }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: "0.75rem" }}>Số lượng ảnh minh họa</label>
                        <select value={numImages} onChange={(e) => setNumImages(e.target.value)} style={{ padding: "0.25rem", fontSize: "0.8rem" }}>
                          <option value="auto">AI tự đề xuất theo độ dài</option>
                          <option value="1">1 ảnh (Chỉ ảnh đại diện)</option>
                          <option value="2">2 ảnh (Đại diện + Giữa bài)</option>
                          <option value="3">3 ảnh</option>
                          <option value="4">4 ảnh</option>
                          <option value="5">5 ảnh</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: "0.75rem" }}>Kích cỡ ảnh xuất</label>
                        <select value={imageSize} onChange={(e) => setImageSize(e.target.value)} style={{ padding: "0.25rem", fontSize: "0.8rem" }}>
                          <option value="1200x800">1200 x 800 (Chuẩn ngang)</option>
                          <option value="1200x628">1200 x 628 (Facebook Cover)</option>
                          <option value="1080x1080">1080 x 1080 (Square)</option>
                        </select>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
                      <button 
                        type="button" 
                        className="btn" 
                        onClick={handleOptimizePost}
                        disabled={isOptimizing}
                        style={{ flex: 1, padding: "0.75rem" }}
                      >
                        {isOptimizing ? "⌛ Đang Tối Ưu & Tạo Ảnh..." : "🔍 Xem Trước & Tối Ưu SEO"}
                      </button>
                    </div>
                  </div>

                  {/* Panel E: Target Websites Selector */}
                  <div className="panel">
                    <h3 className="panel-title">🎯 Đăng bài lên Website mục tiêu</h3>
                    <p style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)", margin: "-0.25rem 0 0.75rem 0" }}>Chọn các website sẽ xuất bản bài viết tối ưu này.</p>
                    
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "150px", overflowY: "auto", border: "1px solid var(--color-border)", borderRadius: "6px", padding: "0.5rem", backgroundColor: "#ffffff" }}>
                      {(!config.websites || config.websites.length === 0) ? (
                        <div style={{ fontSize: "0.8rem", color: "#64748b", fontStyle: "italic" }}>Chưa liên kết website nào. Hãy vào tab Cấu Hình để thêm website.</div>
                      ) : (
                        config.websites.map(site => (
                          <label key={site.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", cursor: "pointer" }}>
                            <input 
                              type="checkbox"
                              checked={selectedWebIds.includes(site.id)}
                              onChange={() => handleToggleSelectWebsite(site.id)}
                            />
                            <strong>{site.name}</strong> <span style={{ color: "#64748b" }}>({site.url})</span>
                          </label>
                        ))
                      )}
                    </div>

                    <div style={{ display: "flex", gap: "1rem", marginTop: "1rem", alignItems: "center" }}>
                      <div style={{ flex: 1 }}>
                        <select 
                          value={params.postStatus}
                          onChange={(e) => setParams(prev => ({ ...prev, postStatus: e.target.value }))}
                          style={{ padding: "0.5rem", fontSize: "0.85rem", width: "100%" }}
                        >
                          <option value="draft">Bản nháp (Draft)</option>
                          <option value="publish">Xuất bản trực tiếp (Publish)</option>
                        </select>
                      </div>
                      <button 
                        type="button" 
                        className="btn" 
                        onClick={handlePublishSingle}
                        disabled={isPublishingSingle || !seoResult}
                        style={{ flex: 1.5, padding: "0.75rem", background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", boxShadow: "0 4px 10px rgba(16, 185, 129, 0.15)" }}
                      >
                        {isPublishingSingle ? "⌛ Đang đăng..." : "🚀 Xuất Bản Website"}
                      </button>
                    </div>
                  </div>
                </div>

              </div>

              {/* Panel F: RESULTS DISPLAY */}
              {seoResult && (
                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "1.5rem", marginTop: "1.5rem" }}>
                  
                  {/* Left Result: HTML Live Preview */}
                  <div className="panel">
                    <h3 className="panel-title">👁️ Bản Xem Trước Bài Viết (HTML Preview)</h3>
                    <div 
                      className="article-preview-content"
                      style={{ 
                        border: "1px solid var(--color-border)", 
                        borderRadius: "8px", 
                        padding: "1.5rem", 
                        backgroundColor: "#ffffff", 
                        maxHeight: "600px", 
                        overflowY: "auto",
                        fontSize: "0.95rem"
                      }}
                      dangerouslySetInnerHTML={{ __html: seoResult.optimizedHtml }}
                    />
                  </div>

                  {/* Right Result: SEO Report & Outputs */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                    
                    {/* Warnings and SEO Audit */}
                    <div className="panel" style={{ borderColor: seoResult.warnings?.length > 0 ? "var(--warning)" : "var(--success)" }}>
                      <h3 className="panel-title">📊 Báo Cáo Tối Ưu SEO Nha Khoa</h3>
                      <div style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>
                        <div>Độ dài bài viết: <strong>{seoResult.wordCount} từ</strong></div>
                        <div>Ảnh tối ưu đề xuất: <strong>{seoResult.images?.length} ảnh</strong></div>
                        <div>Backlink đã chèn: <strong>{seoResult.insertedLinks?.length} links</strong></div>
                      </div>

                      {seoResult.warnings?.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.75rem" }}>
                          {seoResult.warnings.map((warn, wIdx) => (
                            <div key={wIdx} className="connection-test-result test-error" style={{ fontSize: "0.75rem", padding: "0.45rem", margin: 0 }}>
                              ⚠️ {warn}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="connection-test-result test-success" style={{ fontSize: "0.8rem", padding: "0.45rem", margin: 0, marginTop: "0.75rem" }}>
                          ✅ Tuyệt vời! Bài viết không vi phạm các cảnh báo an toàn SEO (không spam link, đa dạng anchor text).
                        </div>
                      )}
                    </div>

                    {/* Created Branded Images list */}
                    <div className="panel">
                      <h3 className="panel-title">🖼️ Danh sách Hình ảnh đã thiết kế</h3>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxHeight: "300px", overflowY: "auto" }}>
                        {seoResult.images?.map((img, iIdx) => (
                          <div key={iIdx} style={{ display: "flex", gap: "0.5rem", border: "1px solid var(--color-border)", padding: "0.5rem", borderRadius: "6px", backgroundColor: "#ffffff" }}>
                            <img src={img.url} alt={img.altText} style={{ width: "60px", height: "40px", objectFit: "cover", borderRadius: "4px" }} />
                            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.15rem", overflow: "hidden" }}>
                              <span style={{ fontSize: "0.75rem", fontWeight: "bold", textTransform: "capitalize", color: "var(--color-primary)" }}>
                                Type: {img.type} (SEO File: {img.filename})
                              </span>
                              <span style={{ fontSize: "0.7rem", color: "var(--color-text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={`Alt: ${img.altText}`}>
                                <strong>Alt:</strong> {img.altText}
                              </span>
                              {img.caption && (
                                <span style={{ fontSize: "0.65rem", fontStyle: "italic", color: "#64748b" }}>
                                  <strong>Caption:</strong> {img.caption}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Backlinks report list */}
                    <div className="panel">
                      <h3 className="panel-title">🔗 Backlinks đã chèn</h3>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "250px", overflowY: "auto" }}>
                        {seoResult.insertedLinks?.map((link, lIdx) => (
                          <div key={lIdx} style={{ display: "flex", flexDirection: "column", border: "1px solid var(--color-border)", padding: "0.5rem", borderRadius: "6px", backgroundColor: "#ffffff", fontSize: "0.75rem" }}>
                            <div>URL: <a href={link.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-primary)" }}>{link.url}</a></div>
                            <div>Anchor Text: <strong>"{link.anchorText}"</strong></div>
                            <div style={{ fontStyle: "italic", color: "#64748b", marginTop: "0.15rem" }}>Ngữ cảnh: "...{link.context}..."</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* WordPress Publish Single Result */}
                    {seoPublishResult && (
                      <div className="panel" style={{ backgroundColor: "#ecfdf5", borderColor: "#10b981" }}>
                        <h3 className="panel-title" style={{ color: "#065f46" }}>🎉 Kết Quả Xuất Bản Đa Website</h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.5rem" }}>
                          {seoPublishResult.results?.map((pubRes, pIdx) => (
                            <div key={pIdx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem", paddingBottom: "0.25rem", borderBottom: "1px solid #d1fae5" }}>
                              <span>🌐 {pubRes.siteName}</span>
                              {pubRes.success ? (
                                <a href={pubRes.link} target="_blank" rel="noopener noreferrer" style={{ color: "#047857", fontWeight: "bold" }}>Xem bài ↗</a>
                              ) : (
                                <span style={{ color: "#b91c1c" }} title={pubRes.error}>Lỗi ❌</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>

                </div>
              )}
            </>
          )}

          {/* TAB 3: SETTINGS & WEBSITES */}
          {activeTab === "settings" && (
            <>
              <div className="tab-header">
                <div>
                  <h1>⚙️ Cấu Hình API & Quản Lý Website</h1>
                  <p>Cập nhật khóa bảo mật và quản lý đa website liên kết</p>
                </div>
              </div>

              <div className="panel">
                <h3 className="panel-title">🔑 Cấu Hình Khóa API Bảo Mật</h3>
                <div className="form-group">
                  <label>Google Gemini API Key</label>
                  <input
                    type="password"
                    name="geminiKey"
                    value={config.geminiKey || ""}
                    onChange={handleConfigChange}
                    placeholder="Nhập API Key Gemini..."
                  />
                </div>

                <div className="form-group">
                  <label>OpenAI API Key (DALL-E / ChatGPT)</label>
                  <input
                    type="password"
                    name="openaiKey"
                    value={config.openaiKey || ""}
                    onChange={handleConfigChange}
                    placeholder="sk-proj-..."
                  />
                </div>

                <div className="form-group">
                  <label>Alibaba Cloud API Key (Qwen Model Studio)</label>
                  <input
                    type="password"
                    name="alibabaKey"
                    value={config.alibabaKey || ""}
                    onChange={handleConfigChange}
                    placeholder="sk-ws-..."
                  />
                </div>

                <div className="form-group">
                  <label>Leonardo.ai API Key</label>
                  <input
                    type="password"
                    name="leonardoKey"
                    value={config.leonardoKey || ""}
                    onChange={handleConfigChange}
                    placeholder="Nhập API Key Leonardo..."
                  />
                </div>

                <div className="form-group">
                  <label>Chỉ thị viết bài tùy chỉnh (AI Directive Prompt)</label>
                  <textarea
                    name="customSystemPrompt"
                    value={config.customSystemPrompt || ""}
                    onChange={handleConfigChange}
                    placeholder="Ví dụ: Hãy viết theo phong cách chuyên nghiệp chuẩn y khoa, sử dụng ngôi xưng 'Nha khoa MaxDent', phân tích khoa học nhưng dễ hiểu, không sử dụng các từ quảng cáo sáo rỗng."
                    rows="3"
                    style={{ resize: "vertical" }}
                  />
                  <span style={{ fontSize: "0.75rem", color: "#64748b", fontStyle: "italic", marginTop: "-0.25rem" }}>
                    Chỉ thị này sẽ được lưu và tự động lồng ghép vào tất cả bài viết về sau.
                  </span>
                </div>

                {apiTestResults && (
                  <div style={{
                    padding: "1rem",
                    borderRadius: "8px",
                    border: "1px solid #bae6fd",
                    backgroundColor: "#f0f9ff",
                    marginBottom: "1rem",
                    fontSize: "0.85rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem"
                  }}>
                    {apiTestResults.gemini && (
                      <div>
                        <strong>Google Gemini:</strong>{" "}
                        <span style={{ color: apiTestResults.gemini?.success ? "#16a34a" : "#dc2626", fontWeight: "bold" }}>
                          {apiTestResults.gemini?.success ? "✓ Hoạt động tốt" : "✗ Thất bại"}
                        </span>
                        {" - "}{apiTestResults.gemini?.message}
                      </div>
                    )}
                    {apiTestResults.openai && (
                      <div>
                        <strong>OpenAI (ChatGPT/DALL-E):</strong>{" "}
                        <span style={{ color: apiTestResults.openai?.success ? "#16a34a" : "#dc2626", fontWeight: "bold" }}>
                          {apiTestResults.openai?.success ? "✓ Hoạt động tốt" : "✗ Thất bại"}
                        </span>
                        {" - "}{apiTestResults.openai?.message}
                      </div>
                    )}
                    {apiTestResults.alibaba && (
                      <div>
                        <strong>Alibaba Cloud (Qwen):</strong>{" "}
                        <span style={{ color: apiTestResults.alibaba?.success ? "#16a34a" : "#dc2626", fontWeight: "bold" }}>
                          {apiTestResults.alibaba?.success ? "✓ Hoạt động tốt" : "✗ Thất bại"}
                        </span>
                        {" - "}{apiTestResults.alibaba?.message}
                      </div>
                    )}
                    {apiTestResults.leonardo && (
                      <div>
                        <strong>Leonardo.ai:</strong>{" "}
                        <span style={{ color: apiTestResults.leonardo?.success ? "#16a34a" : "#dc2626", fontWeight: "bold" }}>
                          {apiTestResults.leonardo?.success ? "✓ Hoạt động tốt" : "✗ Thất bại"}
                        </span>
                        {" - "}{apiTestResults.leonardo?.message}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
                  <button 
                    className="btn" 
                    onClick={handleTestApiKeys} 
                    disabled={isTestingApis}
                    style={{ 
                      padding: "0.75rem 1.25rem",
                      fontSize: "0.9rem",
                      background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                      color: "white",
                      border: "none",
                      boxShadow: "0 4px 10px rgba(59, 130, 246, 0.15)"
                    }}
                  >
                    {isTestingApis ? "⌛ Đang kiểm tra..." : "🔌 Kiểm Tra Kết Nối API"}
                  </button>
                  <button className="btn btn-secondary" onClick={handleSaveConfig} style={{ margin: 0 }}>
                    💾 Lưu Khóa API & Chỉ Thị
                  </button>
                </div>
              </div>

              {/* BRANDING SETUP PANEL */}
              <div className="panel">
                <h3 className="panel-title">🎨 Đóng Dấu Thương Hiệu Mặc Định</h3>
                <p className="panel-desc">Thiết lập logo và watermark thương hiệu tự động đóng dấu lên hình ảnh bài viết.</p>
                
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                  <label style={{ fontWeight: "600", fontSize: "0.9rem" }}>Kích hoạt đóng dấu logo lên ảnh</label>
                  <input 
                    type="checkbox" 
                    checked={config.hasLogos !== undefined ? config.hasLogos : true} 
                    onChange={(e) => setConfig(prev => ({ ...prev, hasLogos: e.target.checked }))} 
                    style={{ width: "18px", height: "18px", cursor: "pointer" }}
                  />
                </div>

                {(config.hasLogos !== undefined ? config.hasLogos : true) && (
                  <>
                    <div className="grid-2">
                      {/* Logo 1 */}
                      <div className="form-group" style={{ border: "1px dashed var(--color-border)", borderRadius: "8px", padding: "1rem", backgroundColor: "#f8fafc" }}>
                        <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: "600" }}>Logo công ty 1 (Mặc định)</label>
                        {!config.logo1 ? (
                          <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1rem", border: "1px dashed #cbd5e1", borderRadius: "6px", backgroundColor: "#ffffff", cursor: "pointer" }}>
                            <span style={{ fontSize: "1.25rem" }}>➕ Tải Logo 1</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleConfigLogoChange(1, e)}
                              style={{ position: "absolute", opacity: 0, width: "100%", height: "100%", top: 0, left: 0, cursor: "pointer" }}
                              title=""
                            />
                          </div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                            <img src={config.logo1} alt="Logo 1" style={{ width: "60px", height: "60px", objectFit: "contain", borderRadius: "4px", backgroundColor: "#ffffff", border: "1px solid var(--color-border)" }} />
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                              <span style={{ fontSize: "0.8rem", color: "#22c55e", fontWeight: "bold" }}>✓ Đã tải logo 1</span>
                              <button type="button" className="btn-action-small delete" onClick={() => handleRemoveConfigLogo(1)} style={{ width: "fit-content" }}>Xóa</button>
                            </div>
                          </div>
                        )}
                        <div style={{ marginTop: "1rem", borderTop: "1px solid var(--color-border)", paddingTop: "1rem" }}>
                          <div className="form-group" style={{ marginBottom: "0.75rem" }}>
                            <label style={{ fontSize: "0.8rem", fontWeight: "600" }}>Vị trí dán Logo 1</label>
                            <select 
                              value={config.logo1Position || "top-left"} 
                              onChange={(e) => setConfig(prev => ({ ...prev, logo1Position: e.target.value }))}
                              style={{ width: "100%", padding: "0.4rem", fontSize: "0.8rem", marginTop: "0.25rem", borderRadius: "4px", border: "1px solid var(--color-border)" }}
                            >
                              <option value="top-left">Trên bên trái</option>
                              <option value="top-right">Trên bên phải</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label style={{ fontSize: "0.8rem", fontWeight: "600" }}>Kích thước Logo 1 ({config.logo1Scale || 12}%)</label>
                            <input 
                              type="range" 
                              min="8" 
                              max="30" 
                              value={config.logo1Scale || 12}
                              onChange={(e) => setConfig(prev => ({ ...prev, logo1Scale: parseInt(e.target.value) }))}
                              style={{ width: "100%", height: "6px", cursor: "pointer", marginTop: "0.25rem" }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Logo 2 */}
                      <div className="form-group" style={{ border: "1px dashed var(--color-border)", borderRadius: "8px", padding: "1rem", backgroundColor: "#f8fafc" }}>
                        <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: "600" }}>Logo công ty 2 (Mặc định)</label>
                        {!config.logo2 ? (
                          <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1rem", border: "1px dashed #cbd5e1", borderRadius: "6px", backgroundColor: "#ffffff", cursor: "pointer" }}>
                            <span style={{ fontSize: "1.25rem" }}>➕ Tải Logo 2</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleConfigLogoChange(2, e)}
                              style={{ position: "absolute", opacity: 0, width: "100%", height: "100%", top: 0, left: 0, cursor: "pointer" }}
                              title=""
                            />
                          </div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                            <img src={config.logo2} alt="Logo 2" style={{ width: "60px", height: "60px", objectFit: "contain", borderRadius: "4px", backgroundColor: "#ffffff", border: "1px solid var(--color-border)" }} />
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                              <span style={{ fontSize: "0.8rem", color: "#22c55e", fontWeight: "bold" }}>✓ Đã tải logo 2</span>
                              <button type="button" className="btn-action-small delete" onClick={() => handleRemoveConfigLogo(2)} style={{ width: "fit-content" }}>Xóa</button>
                            </div>
                          </div>
                        )}
                        <div style={{ marginTop: "1rem", borderTop: "1px solid var(--color-border)", paddingTop: "1rem" }}>
                          <div className="form-group" style={{ marginBottom: "0.75rem" }}>
                            <label style={{ fontSize: "0.8rem", fontWeight: "600" }}>Vị trí dán Logo 2</label>
                            <select 
                              value={config.logo2Position || "top-right"} 
                              onChange={(e) => setConfig(prev => ({ ...prev, logo2Position: e.target.value }))}
                              style={{ width: "100%", padding: "0.4rem", fontSize: "0.8rem", marginTop: "0.25rem", borderRadius: "4px", border: "1px solid var(--color-border)" }}
                            >
                              <option value="top-left">Trên bên trái</option>
                              <option value="top-right">Trên bên phải</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label style={{ fontSize: "0.8rem", fontWeight: "600" }}>Kích thước Logo 2 ({config.logo2Scale || 15}%)</label>
                            <input 
                              type="range" 
                              min="8" 
                              max="30" 
                              value={config.logo2Scale || 15}
                              onChange={(e) => setConfig(prev => ({ ...prev, logo2Scale: parseInt(e.target.value) }))}
                              style={{ width: "100%", height: "6px", cursor: "pointer", marginTop: "0.25rem" }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: "1rem", maxWidth: "320px" }}>
                      <div className="form-group">
                        <label style={{ fontWeight: "600" }}>Kích thước ảnh mặc định</label>
                        <select 
                          value={config.imageSize || "1200x800"} 
                          onChange={(e) => setConfig(prev => ({ ...prev, imageSize: e.target.value }))}
                          style={{ marginTop: "0.25rem" }}
                        >
                          <option value="1200x800">1200 x 800 (Chuẩn ngang)</option>
                          <option value="1200x628">1200 x 628 (Facebook Cover)</option>
                          <option value="1080x1080">1080 x 1080 (Square)</option>
                        </select>
                      </div>
                    </div>
                  </>
                )}

                <button className="btn btn-secondary" onClick={handleSaveConfig} style={{ alignSelf: "flex-end", marginTop: "1rem" }}>
                  💾 Lưu Cấu Hình Thương Hiệu
                </button>
              </div>

              {/* DEFAULT BACKLINKS MANAGEMENT PANEL */}
              <div className="panel">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <div>
                    <h3 className="panel-title" style={{ margin: 0 }}>🔗 Danh Sách Backlink Mặc Định</h3>
                    <p className="panel-desc" style={{ margin: 0 }}>Cấu hình các liên kết nội bộ/thương hiệu sẽ tự động chèn vào bài viết.</p>
                  </div>
                  <button type="button" className="btn-action-small" onClick={handleAddConfigBacklink}>➕ Thêm Link</button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "1rem" }}>
                  {(!config.backlinks || config.backlinks.length === 0) ? (
                    <div style={{ textAlign: "center", padding: "1.5rem", color: "#64748b", fontStyle: "italic", border: "1px dashed var(--color-border)", borderRadius: "6px" }}>
                      Chưa cấu hình backlink mặc định. Hãy click 'Thêm Link' để bắt đầu.
                    </div>
                  ) : (
                    config.backlinks.map((link, idx) => (
                      <div key={idx} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end", backgroundColor: "#f8fafc", padding: "0.75rem", borderRadius: "6px", border: "1px solid var(--color-border)" }}>
                        <div style={{ flex: 2, display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                          <label style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: "600" }}>Địa chỉ URL</label>
                          <input 
                            type="url" 
                            value={link.url}
                            onChange={(e) => handleConfigBacklinkChange(idx, "url", e.target.value)}
                            placeholder="https://maxdent.vn"
                            style={{ padding: "0.4rem", fontSize: "0.85rem", width: "100%", boxSizing: "border-box" }}
                          />
                        </div>
                        <div style={{ flex: 1.5, display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                          <label style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: "600" }}>Anchor Text</label>
                          <input 
                            type="text" 
                            value={link.anchorText}
                            onChange={(e) => handleConfigBacklinkChange(idx, "anchorText", e.target.value)}
                            placeholder="MaxDent"
                            style={{ padding: "0.4rem", fontSize: "0.85rem", width: "100%", boxSizing: "border-box" }}
                          />
                        </div>
                        <div style={{ flex: 1.2, display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                          <label style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: "600" }}>Loại link</label>
                          <select 
                            value={link.linkType}
                            onChange={(e) => handleConfigBacklinkChange(idx, "linkType", e.target.value)}
                            style={{ padding: "0.4rem", fontSize: "0.85rem", width: "100%" }}
                          >
                            <option value="brand">Thương hiệu</option>
                            <option value="keyword_main">Từ khóa chính</option>
                            <option value="keyword_sub">Từ khóa phụ</option>
                            <option value="naked">URL trần</option>
                            <option value="cta">CTA tự nhiên</option>
                          </select>
                        </div>
                        <button type="button" className="btn-action-small delete" onClick={() => handleRemoveConfigBacklink(idx)} style={{ height: "35px", padding: "0.25rem 0.5rem" }}>🗑️</button>
                      </div>
                    ))
                  )}
                </div>

                <button className="btn btn-secondary" onClick={handleSaveConfig} style={{ alignSelf: "flex-end", marginTop: "1rem" }}>
                  💾 Lưu Cấu Hình Backlinks
                </button>
              </div>

              {/* Targets websites manager */}
              <div className="panel">
                <h3 className="panel-title">🌐 Danh Sách Website WordPress</h3>
                <p className="panel-desc">Tích chọn website để chỉ định đăng bài chiến dịch.</p>

                <div style={{ overflowX: "auto" }}>
                  <table style={{ minWidth: "600px" }}>
                    <thead>
                      <tr>
                        <th style={{ width: "40px", textAlign: "center" }}>Chọn</th>
                        <th>Tên website</th>
                        <th>Địa chỉ URL</th>
                        <th>Tài khoản</th>
                        <th style={{ width: "220px", textAlign: "right" }}>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(!config.websites || config.websites.length === 0) ? (
                        <tr>
                          <td colSpan="5" style={{ textAlign: "center", color: "#64748b", fontStyle: "italic", padding: "2rem" }}>
                            Chưa liên kết website nào. Vui lòng thêm bằng form bên dưới.
                          </td>
                        </tr>
                      ) : (
                        config.websites.map((site) => (
                          <tr key={site.id}>
                            <td style={{ textAlign: "center" }}>
                              <input
                                type="checkbox"
                                checked={selectedWebIds.includes(site.id)}
                                onChange={() => handleToggleSelectWebsite(site.id)}
                                style={{ width: "16px", height: "16px", cursor: "pointer" }}
                              />
                            </td>
                            <td style={{ fontWeight: "600" }}>{site.name}</td>
                            <td style={{ color: "#64748b" }}>{site.url}</td>
                            <td><code>{site.user}</code></td>
                            <td style={{ textAlign: "right" }}>
                              <div style={{ display: "inline-flex", gap: "0.45rem" }}>
                                <button
                                  className="btn-action-small"
                                  onClick={() => handleTestSiteConnection(site)}
                                  disabled={testingSiteId === site.id}
                                >
                                  {testingSiteId === site.id ? "⌛" : "⚡ Test"}
                                </button>
                                <button
                                  className="btn-action-small"
                                  onClick={() => handleStartEditWebsite(site)}
                                >
                                  ✏️ Sửa
                                </button>
                                <button
                                  className="btn-action-small delete"
                                  onClick={() => handleDeleteWebsite(site.id)}
                                >
                                  🗑️ Xóa
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Add/Edit Form Box */}
                <div className="add-website-box" style={{ borderColor: editingSiteId ? "var(--warning)" : "var(--color-border)" }}>
                  <h4 style={{ color: editingSiteId ? "var(--warning-text)" : "var(--color-text)" }}>
                    {editingSiteId ? "✏️ Chỉnh Sửa Kết Nối Website" : "➕ Liên Kết Website WordPress Mới"}
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <div className="input-row">
                      <div className="form-group">
                        <label>Tên nhãn web</label>
                        <input
                          type="text"
                          placeholder="Ví dụ: MaxDent"
                          value={newSite.name}
                          onChange={(e) => setNewSite(prev => ({ ...prev, name: e.target.value }))}
                        />
                      </div>
                      <div className="form-group">
                        <label>Địa chỉ URL WordPress (HTTPS)</label>
                        <input
                          type="url"
                          placeholder="Ví dụ: https://maxdent.vn"
                          value={newSite.url}
                          onChange={(e) => setNewSite(prev => ({ ...prev, url: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="input-row">
                      <div className="form-group">
                        <label>Tài khoản đăng nhập (Username)</label>
                        <input
                          type="text"
                          placeholder="admin"
                          value={newSite.user}
                          onChange={(e) => setNewSite(prev => ({ ...prev, user: e.target.value }))}
                        />
                      </div>
                      <div className="form-group">
                        <label>Mật khẩu ứng dụng (Application Password)</label>
                        <input
                          type="password"
                          placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                          value={newSite.password}
                          onChange={(e) => setNewSite(prev => ({ ...prev, password: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleTestNewConnection}
                        disabled={isTestingNew}
                      >
                        {isTestingNew ? "Đang kiểm tra..." : "⚡ Kiểm Tra Kết Nối"}
                      </button>
                      
                      {editingSiteId && (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={handleCancelEdit}
                          style={{ color: "var(--danger-text)" }}
                        >
                          Hủy
                        </button>
                      )}
                      
                      <button
                        type="button"
                        className="btn"
                        onClick={handleAddWebsite}
                        style={{ 
                          background: editingSiteId ? "linear-gradient(135deg, #d97706 0%, #b45309 100%)" : undefined,
                          boxShadow: editingSiteId ? "0 4px 10px rgba(217, 119, 6, 0.2)" : undefined
                        }}
                      >
                        {editingSiteId ? "💾 Cập Nhật" : "➕ Thêm Web"}
                      </button>
                    </div>

                    {testNewResult && (
                      <div className={`connection-test-result ${testNewResult.success ? "test-success" : "test-error"}`}>
                        {testNewResult.success ? "✅" : "❌"} {testNewResult.message}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* TAB: RSS 4-STEP AUTOMATION SCENARIO */}
          {activeTab === "rss-scenario" && (
            <>
              <div className="tab-header">
                <div>
                  <h1>📡 Kịch Bản RSS Auto-Publisher (Scenario)</h1>
                  <p>Luồng tự động hóa 4 bước lấy tin tức RSS, làm sạch HTML, viết lại bằng Alibaba Qwen và đăng nháp lên WordPress</p>
                </div>
              </div>

              <div className="stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginBottom: "1.5rem" }}>
                <div className="stat-card" style={{ borderLeft: "4px solid #3b82f6" }}>
                  <div className="stat-icon blue">🔗</div>
                  <div className="stat-details">
                    <span className="stat-label">Bước 1: Nguồn RSS</span>
                    <span className="stat-value" style={{ fontSize: "1.1rem" }}>Liên kết / RSS</span>
                  </div>
                </div>
                <div className="stat-card" style={{ borderLeft: "4px solid #10b981" }}>
                  <div className="stat-icon green">🧹</div>
                  <div className="stat-details">
                    <span className="stat-label">Bước 2: Text Parser</span>
                    <span className="stat-value" style={{ fontSize: "1.1rem" }}>Lọc Sạch HTML</span>
                  </div>
                </div>
                <div className="stat-card" style={{ borderLeft: "4px solid #8b5cf6" }}>
                  <div className="stat-icon purple">✨</div>
                  <div className="stat-details">
                    <span className="stat-label">Bước 3: AI Rewrite</span>
                    <span className="stat-value" style={{ fontSize: "1.1rem" }}>Alibaba Qwen Plus</span>
                  </div>
                </div>
                <div className="stat-card" style={{ borderLeft: "4px solid #f59e0b" }}>
                  <div className="stat-icon orange">📝</div>
                  <div className="stat-details">
                    <span className="stat-label">Bước 4: WordPress</span>
                    <span className="stat-value" style={{ fontSize: "1.1rem" }}>Chế độ Draft</span>
                  </div>
                </div>
              </div>

              <div className="panel">
                <h3 className="panel-title">⚙️ Cấu Hình Luồng Chạy</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1rem" }}>
                  <div className="form-group">
                    <label>Đường dẫn bài viết hoặc nguồn RSS (Article Link or RSS Feed)</label>
                    <input
                      type="text"
                      value={rssUrlInput}
                      onChange={(e) => setRssUrlInput(e.target.value)}
                      placeholder="Dán link bài viết hoặc nguồn RSS của bạn..."
                    />
                  </div>
                  <div className="form-group">
                    <label>Website vệ tinh nhận bài</label>
                    <select
                      value={rssTargetWebsite}
                      onChange={(e) => setRssTargetWebsite(e.target.value)}
                    >
                      <option value="">-- Website cấu hình đầu tiên (Mặc định) --</option>
                      {(config.websites || []).map((site) => (
                        <option key={site.id} value={site.id}>
                          {site.name} ({site.url})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end", marginTop: "1rem" }}>
                  <button
                    className="btn"
                    onClick={handleRunRssScenario}
                    disabled={isRunningRssScenario}
                    style={{
                      padding: "0.75rem 1.5rem",
                      fontSize: "0.95rem",
                      background: isRunningRssScenario
                        ? "#94a3b8"
                        : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                      color: "white",
                      border: "none",
                      boxShadow: "0 4px 12px rgba(16, 185, 129, 0.2)",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      cursor: isRunningRssScenario ? "not-allowed" : "pointer"
                    }}
                  >
                    {isRunningRssScenario ? (
                      <>
                        <span className="spinner-mini"></span>
                        Đang thực thi kịch bản...
                      </>
                    ) : (
                      "🚀 Kích Hoạt Scenario 4-Bước"
                    )}
                  </button>
                </div>
              </div>

              {rssError && (
                <div className="panel" style={{ backgroundColor: "#fef2f2", border: "1px solid #fee2e2", color: "#991b1b" }}>
                  <strong>Lỗi thực thi Scenario:</strong> {rssError}
                </div>
              )}

              {/* Steps Progress Detail */}
              {(isRunningRssScenario || rssScenarioResults) && (
                <div className="panel" style={{ marginTop: "1.5rem" }}>
                  <h3 className="panel-title">📊 Kết Quả Thực Thi Chi Tiết</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", position: "relative", paddingLeft: "1.5rem" }}>
                    
                    {/* Decorative Timeline Line */}
                    <div style={{
                      position: "absolute",
                      left: "7px",
                      top: "10px",
                      bottom: "10px",
                      width: "2px",
                      backgroundColor: "#e2e8f0",
                      zIndex: 1
                    }}></div>

                    {/* STEP 1 */}
                    <div style={{ position: "relative", zIndex: 2 }}>
                      <div style={{
                        position: "absolute",
                        left: "-23px",
                        top: "2px",
                        width: "18px",
                        height: "18px",
                        borderRadius: "50%",
                        backgroundColor: isRunningRssScenario && !rssScenarioResults?.step1 ? "#3b82f6" : (rssScenarioResults?.step1?.success ? "#10b981" : "#ef4444"),
                        border: "3px solid white",
                        boxShadow: "0 0 0 2px #e2e8f0"
                      }}></div>
                      <strong>Bước 1: Lấy tin bài viết / RSS</strong>
                      {isRunningRssScenario && !rssScenarioResults?.step1 && (
                        <div style={{ color: "#64748b", fontSize: "0.85rem", fontStyle: "italic" }}>Đang tải nội dung bài viết/RSS...</div>
                      )}
                      {rssScenarioResults?.step1 && (
                        <div style={{
                          marginTop: "0.5rem",
                          padding: "0.75rem",
                          backgroundColor: "#f8fafc",
                          borderRadius: "6px",
                          fontSize: "0.85rem"
                        }}>
                          {rssScenarioResults.step1.success ? (
                            <>
                              <div style={{ color: "#16a34a", fontWeight: "bold", marginBottom: "0.25rem" }}>✓ Lấy tin thành công!</div>
                              <div><strong>Tiêu đề:</strong> {rssScenarioResults.step1.data?.title}</div>
                              <div><strong>Link gốc:</strong> <a href={rssScenarioResults.step1.data?.link} target="_blank" rel="noreferrer" style={{ color: "#3b82f6" }}>{rssScenarioResults.step1.data?.link}</a></div>
                            </>
                          ) : (
                            <div style={{ color: "#dc2626" }}>✗ Thất bại: {rssScenarioResults.step1.error}</div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* STEP 2 */}
                    <div style={{ position: "relative", zIndex: 2 }}>
                      <div style={{
                        position: "absolute",
                        left: "-23px",
                        top: "2px",
                        width: "18px",
                        height: "18px",
                        borderRadius: "50%",
                        backgroundColor: isRunningRssScenario && rssScenarioResults?.step1 && !rssScenarioResults?.step2 ? "#3b82f6" : (rssScenarioResults?.step2?.success ? "#10b981" : (rssScenarioResults?.step2 ? "#ef4444" : "#94a3b8")),
                        border: "3px solid white",
                        boxShadow: "0 0 0 2px #e2e8f0"
                      }}></div>
                      <strong>Bước 2: Lọc sạch mã HTML (Text Parser)</strong>
                      {isRunningRssScenario && rssScenarioResults?.step1 && !rssScenarioResults?.step2 && (
                        <div style={{ color: "#64748b", fontSize: "0.85rem", fontStyle: "italic" }}>Đang bóc tách, chuẩn hóa văn bản...</div>
                      )}
                      {rssScenarioResults?.step2 && (
                        <div style={{
                          marginTop: "0.5rem",
                          padding: "0.75rem",
                          backgroundColor: "#f8fafc",
                          borderRadius: "6px",
                          fontSize: "0.85rem"
                        }}>
                          {rssScenarioResults.step2.success ? (
                            <>
                              <div style={{ color: "#16a34a", fontWeight: "bold", marginBottom: "0.25rem" }}>✓ Đã xử lý text parser lọc sạch HTML!</div>
                              <div style={{ color: "#64748b", maxHeight: "80px", overflowY: "auto", fontFamily: "monospace" }}>
                                {rssScenarioResults.step2.data?.cleanedText}
                              </div>
                            </>
                          ) : (
                            <div style={{ color: "#dc2626" }}>✗ Thất bại: {rssScenarioResults.step2.error}</div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* STEP 3 */}
                    <div style={{ position: "relative", zIndex: 2 }}>
                      <div style={{
                        position: "absolute",
                        left: "-23px",
                        top: "2px",
                        width: "18px",
                        height: "18px",
                        borderRadius: "50%",
                        backgroundColor: isRunningRssScenario && rssScenarioResults?.step2 && !rssScenarioResults?.step3 ? "#3b82f6" : (rssScenarioResults?.step3?.success ? "#10b981" : (rssScenarioResults?.step3 ? "#ef4444" : "#94a3b8")),
                        border: "3px solid white",
                        boxShadow: "0 0 0 2px #e2e8f0"
                      }}></div>
                      <strong>Bước 3: Alibaba Qwen AI viết lại bài & Chèn backlink ngẫu nhiên</strong>
                      {isRunningRssScenario && rssScenarioResults?.step2 && !rssScenarioResults?.step3 && (
                        <div style={{ color: "#64748b", fontSize: "0.85rem", fontStyle: "italic" }}>Đang gửi yêu cầu AI tối ưu chuẩn SEO (Có thể mất 15-30 giây)...</div>
                      )}
                      {rssScenarioResults?.step3 && (
                        <div style={{
                          marginTop: "0.5rem",
                          padding: "0.75rem",
                          backgroundColor: "#f8fafc",
                          borderRadius: "6px",
                          fontSize: "0.85rem"
                        }}>
                          {rssScenarioResults.step3.success ? (
                            <>
                              <div style={{ color: "#16a34a", fontWeight: "bold", marginBottom: "0.25rem" }}>
                                ✓ Hoàn thành viết lại bài (Model: {rssScenarioResults.step3.data?.modelUsed})
                              </div>
                              <div style={{ marginBottom: "0.5rem" }}>
                                <strong>Backlink được chèn:</strong>{" "}
                                <a href={rssScenarioResults.step3.data?.backlink} target="_blank" rel="noreferrer" style={{ color: "#3b82f6", fontWeight: "bold" }}>
                                  {rssScenarioResults.step3.data?.anchorText} ({rssScenarioResults.step3.data?.backlink})
                                </a>
                              </div>
                              <details style={{ marginTop: "0.25rem" }}>
                                <summary style={{ cursor: "pointer", color: "#3b82f6", fontWeight: "500" }}>Xem bài viết HTML gốc</summary>
                                <pre style={{
                                  padding: "0.5rem",
                                  backgroundColor: "#0f172a",
                                  color: "#f8fafc",
                                  borderRadius: "4px",
                                  overflowX: "auto",
                                  marginTop: "0.5rem",
                                  fontSize: "0.75rem",
                                  maxHeight: "200px",
                                  overflowY: "auto",
                                  whiteSpace: "pre-wrap"
                                }}>
                                  {rssScenarioResults.step3.data?.rewrittenHtml}
                                </pre>
                              </details>
                            </>
                          ) : (
                            <div style={{ color: "#dc2626" }}>✗ Thất bại: {rssScenarioResults.step3.error}</div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* STEP 4 */}
                    <div style={{ position: "relative", zIndex: 2 }}>
                      <div style={{
                        position: "absolute",
                        left: "-23px",
                        top: "2px",
                        width: "18px",
                        height: "18px",
                        borderRadius: "50%",
                        backgroundColor: isRunningRssScenario && rssScenarioResults?.step3 && !rssScenarioResults?.step4 ? "#3b82f6" : (rssScenarioResults?.step4?.success ? "#10b981" : (rssScenarioResults?.step4 ? "#ef4444" : "#94a3b8")),
                        border: "3px solid white",
                        boxShadow: "0 0 0 2px #e2e8f0"
                      }}></div>
                      <strong>Bước 4: Đăng lên WordPress Satellite (Draft Mode)</strong>
                      {isRunningRssScenario && rssScenarioResults?.step3 && !rssScenarioResults?.step4 && (
                        <div style={{ color: "#64748b", fontSize: "0.85rem", fontStyle: "italic" }}>Đang kết nối WordPress API và tạo bản nháp...</div>
                      )}
                      {rssScenarioResults?.step4 && (
                        <div style={{
                          marginTop: "0.5rem",
                          padding: "0.75rem",
                          backgroundColor: "#f8fafc",
                          borderRadius: "6px",
                          fontSize: "0.85rem"
                        }}>
                          {rssScenarioResults.step4.success ? (
                            <>
                              <div style={{ color: "#16a34a", fontWeight: "bold", marginBottom: "0.5rem" }}>
                                🎉 Đăng bài nháp thành công! (ID: {rssScenarioResults.step4.data?.postId})
                              </div>
                              <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                                <div><strong>Trang vệ tinh:</strong> {rssScenarioResults.step4.data?.siteName}</div>
                                <a
                                  href={rssScenarioResults.step4.data?.postLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn"
                                  style={{
                                    padding: "0.4rem 0.8rem",
                                    fontSize: "0.8rem",
                                    background: "#3b82f6",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "4px"
                                  }}
                                >
                                  🔗 Xem Bản Nháp trên Web
                                </a>
                              </div>
                            </>
                          ) : (
                            <div style={{ color: "#dc2626" }}>✗ Thất bại: {rssScenarioResults.step4.error}</div>
                          )}
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              )}
            </>
          )}

          {/* TAB 4: QUEUE PROCESS MONITOR */}
          {activeTab === "queue" && (
            <>
              <div className="tab-header">
                <div>
                  <h1>💻 Tiến Trình Xử Lý Thực Tế</h1>
                  <p>Theo dõi thời gian thực quá trình nghiên cứu và xuất bản bài đăng</p>
                </div>
              </div>

              {/* Progress Summary and Bar */}
              {taskTopics.length > 0 ? (
                <div className="panel">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                    <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: "700" }}>
                      📊 Tiến độ chiến dịch hàng loạt
                    </h3>
                    <span style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)" }}>
                      Đã xong {completedJobs}/{totalJobs} bài đăng ({progressPercent}%)
                    </span>
                  </div>
                  
                  <div className="progress-bar-container">
                    <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }}></div>
                  </div>

                  {/* Grid Table Progress */}
                  <div className="progress-grid-container" style={{ border: "1px solid var(--color-border)", borderRadius: "8px", padding: "0.75rem", backgroundColor: "#f8fafc" }}>
                    <table className="progress-grid-table">
                      <thead>
                        <tr>
                          <th style={{ padding: "0.5rem" }}>Chủ đề bài viết</th>
                          {taskWebsites.map((site) => (
                            <th key={site.id} style={{ textAlign: "center", padding: "0.5rem" }}>{site.name}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {taskTopics.map((topic, tIdx) => (
                          <tr key={tIdx}>
                            <td style={{ padding: "0.65rem 0.5rem", fontWeight: "600", fontSize: "0.85rem", maxWidth: "250px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={topic}>
                              {tIdx + 1}. {topic}
                            </td>
                            {taskWebsites.map((site) => {
                              const prog = taskProgress[`${tIdx}_${site.id}`] || { status: "pending" };
                              return (
                                <td key={site.id} style={{ padding: "0.65rem 0.5rem", textAlign: "center" }}>
                                  {prog.status === "pending" && (
                                    <span className="status-badge idle" style={{ fontSize: "0.65rem", padding: "0.15rem 0.4rem" }}>Chờ ⏳</span>
                                  )}
                                  {prog.status === "running" && (
                                    <span className="status-badge running" style={{ fontSize: "0.65rem", padding: "0.15rem 0.4rem", animation: "pulse 1.2s infinite" }}>Đang chạy 🔄</span>
                                  )}
                                  {prog.status === "completed" && (
                                    <a
                                      href={prog.result?.link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{ color: "var(--success-text)", backgroundColor: "var(--success-bg)", textDecoration: "none", fontWeight: "bold", padding: "0.15rem 0.4rem", borderRadius: "4px", fontSize: "0.65rem" }}
                                    >
                                      Xem bài ↗
                                    </a>
                                  )}
                                  {prog.status === "failed" && (
                                    <span
                                      className="status-badge failed"
                                      style={{ fontSize: "0.65rem", padding: "0.15rem 0.4rem", cursor: "help" }}
                                      title={prog.error}
                                    >
                                      Lỗi ❌
                                    </span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="panel" style={{ textAlign: "center", padding: "3rem 1.5rem", color: "#64748b" }}>
                  <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🔍</div>
                  <h3>Chưa có chiến dịch nào đang chạy</h3>
                  <p style={{ margin: "0.25rem 0 1.5rem 0", fontSize: "0.9rem" }}>Hãy thiết lập và chạy chiến dịch soạn bài mới của bạn.</p>
                  <button className="btn" onClick={() => setActiveTab("campaign")}>
                    Soạn Campaign ngay ➜
                  </button>
                </div>
              )}

              {/* Console log box */}
              {taskTopics.length > 0 && (
                <div className="panel">
                  <h3 className="panel-title">💻 Chi Tiết Log Kỹ Thuật</h3>
                  <p className="panel-desc">Nhật ký xử lý chi tiết theo thời gian thực.</p>
                  
                  <div className="console-box" ref={consoleBoxRef}>
                    {steps.length === 0 ? (
                      <div style={{ color: "#64748b", fontStyle: "italic" }}>
                        Khởi tạo tiến trình...
                      </div>
                    ) : (
                      steps.map((step, idx) => (
                        <div key={idx} className="log-entry">
                          <span className="log-time">[{step.timestamp}]</span>
                          <span className={`log-message log-${step.type}`}>
                            {step.type === "success" && "✓ "}
                            {step.type === "error" && "✗ "}
                            {step.type === "warning" && "⚠ "}
                            {step.message}
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Summary card if completed */}
                  {taskStatus === "completed" && result && (
                    <div className="success-card">
                      <h3>🎉 Chiến dịch hoàn tất!</h3>
                      <p>{result.message}</p>
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "center", marginTop: "0.25rem" }}>
                        {result.allResults && result.allResults.map((item, index) => (
                          <a
                            key={index}
                            href={item.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary"
                            style={{ fontSize: "0.75rem", padding: "0.35rem 0.65rem" }}
                          >
                            🔗 {item.title.length > 25 ? item.title.substring(0, 25) + "..." : item.title}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Overall Error block */}
                  {taskStatus === "failed" && errorMsg && (
                    <div className="connection-test-result test-error" style={{ whiteSpace: "pre-wrap" }}>
                      <strong>Lỗi hệ thống:</strong> {errorMsg}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* TAB 5: PUBLISH HISTORY */}
          {activeTab === "history" && (
            <>
              <div className="tab-header">
                <div>
                  <h1>📚 Lịch Sử Đăng Bài Đa Kênh</h1>
                  <p>Tra cứu và quản lý các bài đăng SEO đã xuất bản thành công</p>
                </div>
              </div>

              {/* Filters UI */}
              <div className="filters-row">
                <span className="filters-label">Bộ lọc:</span>
                <input
                  type="text"
                  placeholder="Tìm kiếm chủ đề/tiêu đề..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  style={{ flex: 1, padding: "0.45rem 0.75rem" }}
                />
                <select 
                  value={siteFilter} 
                  onChange={(e) => setSiteFilter(e.target.value)}
                  style={{ minWidth: "180px" }}
                >
                  <option value="">-- Tất cả website --</option>
                  {/* Extract unique site urls from history */}
                  {Array.from(new Set(history.map(h => h.websiteUrl).filter(Boolean))).map((url, idx) => {
                    const name = history.find(h => h.websiteUrl === url)?.websiteName || url;
                    return <option key={idx} value={url}>{name}</option>;
                  })}
                </select>
                
                {filteredHistory.length !== history.length && (
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => { setSearchFilter(""); setSiteFilter(""); }}
                    style={{ padding: "0.45rem 0.75rem", fontSize: "0.8rem" }}
                  >
                    Xóa lọc
                  </button>
                )}
              </div>

              {/* Card List of History items */}
              {filteredHistory.length === 0 ? (
                <div className="panel" style={{ textAlign: "center", padding: "4rem 1.5rem", color: "#64748b" }}>
                  <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>📚</div>
                  <h3>Chưa có bài đăng nào phù hợp</h3>
                  <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.9rem" }}>Lịch sử sẽ được tự động cập nhật ngay sau khi chiến dịch viết bài hoàn tất.</p>
                </div>
              ) : (
                <div className="history-grid">
                  {filteredHistory.map((item, idx) => (
                    <div key={idx} className="history-card">
                      {item.imageUrl ? (
                        <img 
                          src={item.imageUrl} 
                          alt={item.title} 
                          className="history-img history-card-img" 
                          onError={(e) => { e.target.style.display = "none"; e.target.parentNode.prepend(document.createRange().createContextualFragment(renderPlaceholderImage())); }}
                        />
                      ) : (
                        renderPlaceholderImage()
                      )}
                      
                      <div className="history-card-body">
                        <span style={{ fontSize: "0.7rem", fontWeight: "700", textTransform: "uppercase", color: "var(--color-primary)", backgroundColor: "var(--color-primary-light)", padding: "0.15rem 0.5rem", borderRadius: "4px", width: "fit-content" }}>
                          🌐 {item.websiteName || "Website"}
                        </span>
                        
                        <a href={item.link} target="_blank" rel="noopener noreferrer" className="history-card-title" title={item.title}>
                          {item.title}
                        </a>
                        
                        <div className="history-card-meta">
                          <span><strong>Chủ đề:</strong> {item.topic}</span>
                          <span><strong>Thời gian:</strong> {item.timestamp}</span>
                        </div>

                        <div className="history-card-actions">
                          <button 
                            type="button" 
                            className="btn btn-secondary" 
                            style={{ fontSize: "0.75rem", padding: "0.4rem" }}
                            onClick={() => handleCopyLink(item.link)}
                          >
                            📋 Copy Link
                          </button>
                          <a 
                            href={item.link} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="btn"
                            style={{ fontSize: "0.75rem", padding: "0.4rem", textDecoration: "none" }}
                          >
                            Xem bài viết ↗
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          
          {/* TAB: ADMIN PANEL */}
          {activeTab === "admin" && user.role === "admin" && user.email === "haison20032812@gmail.com" && (
            <>
              <div className="tab-header">
                <div>
                  <h1>👥 Quản Lý Thành Viên & Hệ Thống</h1>
                  <p>Xem danh sách tài khoản, phân quyền và cấu hình SMTP Gmail gửi mã kích hoạt</p>
                </div>
              </div>

              {/* Stats Overview */}
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon blue">👥</div>
                  <div className="stat-details">
                    <span className="stat-value">{adminUsers.length}</span>
                    <span className="stat-label">Tổng Tài Khoản</span>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon green">✅</div>
                  <div className="stat-details">
                    <span className="stat-value">{adminUsers.filter(u => u.status === "active").length}</span>
                    <span className="stat-label">Đang Hoạt Động</span>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon orange">⏳</div>
                  <div className="stat-details">
                    <span className="stat-value">{adminUsers.filter(u => u.status === "pending").length}</span>
                    <span className="stat-label">Chờ Kích Hoạt</span>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon red">🚫</div>
                  <div className="stat-details">
                    <span className="stat-value">{adminUsers.filter(u => u.status === "suspended").length}</span>
                    <span className="stat-label">Bị Khóa</span>
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "1.5rem" }}>
                {/* Users List Table */}
                <div className="panel" style={{ overflowX: "auto" }}>
                  <h3 className="panel-title">📋 Danh Sách Thành Viên</h3>
                  
                  {isAdminLoadingUsers ? (
                    <div style={{ textAlign: "center", padding: "2rem" }}>
                      <div className="spinner" style={{ borderTopColor: "var(--color-primary)" }}></div>
                      <p style={{ marginTop: "0.5rem" }}>Đang tải danh sách thành viên...</p>
                    </div>
                  ) : (
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Tên đăng nhập</th>
                          <th>Email</th>
                          <th>Quyền hạn</th>
                          <th>Trạng thái</th>
                          <th>Ngày đăng ký</th>
                          <th style={{ textAlign: "right" }}>Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminUsers.length === 0 ? (
                          <tr>
                            <td colSpan="6" style={{ textAlign: "center", color: "#64748b", fontStyle: "italic" }}>
                              Chưa có tài khoản nào đăng ký ngoài bạn.
                            </td>
                          </tr>
                        ) : (
                          adminUsers.map((u) => (
                            <tr key={u.id}>
                              <td style={{ fontWeight: "600" }}>{u.username}</td>
                              <td>{u.email}</td>
                              <td>
                                <span className={`admin-badge role-${u.role}`}>
                                  {u.role === "admin" ? "Quản trị viên" : "Thành viên"}
                                </span>
                              </td>
                              <td>
                                <span className={`admin-badge ${u.status}`}>
                                  {u.status === "active" && "Hoạt động"}
                                  {u.status === "pending" && "Chờ kích hoạt"}
                                  {u.status === "suspended" && "Bị khóa"}
                                </span>
                              </td>
                              <td style={{ color: "#64748b" }}>
                                {new Date(u.createdAt).toLocaleDateString("vi-VN", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric"
                                })}
                              </td>
                              <td style={{ textAlign: "right" }}>
                                {u.id !== user.id ? (
                                  <button
                                    className={`btn-action-small ${u.status === "active" ? "delete" : ""}`}
                                    onClick={() => handleToggleUserStatus(u.id, u.status)}
                                    style={{
                                      padding: "0.35rem 0.6rem",
                                      fontSize: "0.8rem",
                                      fontWeight: "600"
                                    }}
                                  >
                                    {u.status === "active" ? "⛔ Khóa" : "✅ Kích hoạt"}
                                  </button>
                                ) : (
                                  <span style={{ fontSize: "0.8rem", color: "#94a3b8", fontStyle: "italic" }}>
                                    (Tài khoản của bạn)
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* SMTP Email Settings Panel */}
                <div className="panel" style={{ height: "fit-content" }}>
                  <h3 className="panel-title">✉️ Cấu Hình SMTP Gmail Gửi Mã</h3>
                  <p className="panel-desc">
                    Để gửi mã kích hoạt 6 chữ số tới Gmail của thành viên, bạn cần cấu hình tài khoản Gmail gửi mail thông qua SMTP.
                  </p>

                  {adminSmtpMessage && (
                    <div className={adminSmtpMessage.success ? "auth-success" : "auth-error"}>
                      {adminSmtpMessage.success ? "✓" : "⚠️"} {adminSmtpMessage.message}
                    </div>
                  )}

                  <form onSubmit={handleSaveSmtpSettings} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <div className="form-group">
                      <label>Địa chỉ Gmail gửi đi (SMTP Email)</label>
                      <input
                        type="email"
                        value={adminSmtpEmail}
                        onChange={(e) => setAdminSmtpEmail(e.target.value)}
                        placeholder="vi-du@gmail.com"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Mật khẩu ứng dụng Gmail (App Password)</label>
                      <input
                        type="password"
                        value={adminSmtpPassword}
                        onChange={(e) => setAdminSmtpPassword(e.target.value)}
                        placeholder="•••• •••• •••• ••••"
                        required
                      />
                      <span style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem", lineHeight: "1.3" }}>
                        ⚠️ **Chú ý:** Đây không phải mật khẩu đăng nhập Gmail thường. Bạn cần bật Bảo mật 2 lớp cho Gmail, sau đó tạo **Mật khẩu ứng dụng (App Password)** trong phần cài đặt tài khoản Google.
                      </span>
                    </div>
                    
                    <button 
                      className="btn" 
                      type="submit" 
                      disabled={isSavingSmtp} 
                      style={{ 
                        marginTop: "0.5rem",
                        background: "linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)"
                      }}
                    >
                      {isSavingSmtp ? "Đang lưu cấu hình..." : "Lưu Cấu Hình SMTP 💾"}
                    </button>
                  </form>
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}

export default App;
