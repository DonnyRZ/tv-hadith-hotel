export type Language = 'uz' | 'ru' | 'en';

export const DEFAULT_LANGUAGE: Language = 'uz';
export const LANGUAGE_STORAGE_KEY = 'hadith-hotel-staff-language';

export const LANGUAGE_OPTIONS: readonly { code: Language; label: string }[] = [
  { code: 'uz', label: "O'zbekcha" },
  { code: 'ru', label: 'Русский' },
  { code: 'en', label: 'English' },
];

export interface AuthCopy {
  pageTitle: string;
  languageLabel: string;
  brandWorkspace: string;
  brandHeadline: string;
  brandSubcopy: string;
  brandFooterLabel: string;
  footerPlatform: string;
  staffWorkspace: string;
  staffAccess: string;
  welcomeBack: string;
  loginDescription: string;
  email: string;
  emailPlaceholder: string;
  password: string;
  passwordPlaceholder: string;
  showPassword: string;
  hidePassword: string;
  forgotPassword: string;
  invalidEmail: string;
  missingCredentials: string;
  signingIn: string;
  signIn: string;
  invalidCredentials: string;
  serviceUnavailable: string;
  genericError: string;
  internalNote: string;
  backToSignIn: string;
  accountRecovery: string;
  forgotTitle: string;
  forgotDescription: string;
  missingEmail: string;
  continue: string;
  passwordResetNote: string;
  recoveryReady: string;
  recoverySuccessDescription: string;
  returnToSignIn: string;
  sessionActive: string;
  welcomeUser: (name: string) => string;
  activeDescription: string;
  accessRole: string;
  signOut: string;
  roleLabels: Record<string, string>;
  superadmin: SuperadminCopy;
  cafe: CafeCopy;
  receptionist: ReceptionistCopy;
}

export interface CafeCopy {
  pageTitle: string;
  workspaceLabel: string;
  workspaceTitle: string;
  administration: string;
  menu: string;
  menuSubtitle: string;
  cafeName: string;
  mainNavigation: string;
  catalog: string;
  totalItems: string;
  activeItems: string;
  unavailableItems: string;
  searchMenu: string;
  searchMenuPlaceholder: string;
  allStatuses: string;
  active: string;
  inactive: string;
  available: string;
  unavailable: string;
  showing: (count: number) => string;
  showingRange: (from: number, to: number, total: number) => string;
  pagination: string;
  previousPage: string;
  nextPage: string;
  pageLabel: (page: number) => string;
  item: string;
  price: string;
  status: string;
  availability: string;
  sortOrder: string;
  actions: string;
  edit: string;
  activate: string;
  deactivate: string;
  markAvailable: string;
  markUnavailable: string;
  addItem: string;
  createItem: string;
  editItem: string;
  itemDetails: string;
  itemName: string;
  itemNamePlaceholder: string;
  description: string;
  descriptionPlaceholder: string;
  pricePlaceholder: string;
  currency: string;
  currencyPlaceholder: string;
  availableNow: string;
  quantityAllowed: string;
  visibleToGuests: string;
  saveItem: string;
  cancel: string;
  close: string;
  requiredField: string;
  invalidPrice: string;
  noItems: string;
  noItemsDescription: string;
  loading: string;
  errorLoading: string;
  retry: string;
  sessionExpired: string;
  apiError: string;
  duplicateItem: string;
  itemCreated: string;
  itemUpdated: string;
  statusUpdated: string;
  lockedUnit: string;
  noPrice: string;
  dashboard: CafeDashboardCopy;
}

export interface ReceptionistCopy {
  pageTitle: string;
  mainNavigation: string;
  rooms: string;
  room: string;
  searchRooms: string;
  searchPlaceholder: string;
  floorNavigation: string;
  floorLabel: (floor: number) => string;
  floorRange: (from: number, to: number) => string;
  roomBoard: string;
  searchResults: string;
  statusLegend: string;
  vacant: string;
  occupied: string;
  assignGuest: string;
  openRoom: string;
  assignGuestTitle: string;
  guestDetails: string;
  editGuestTitle: string;
  assignGuestDescription: string;
  editGuestDescription: string;
  occupiedRoomDescription: string;
  guestName: string;
  guestNamePlaceholder: string;
  guestNameHint: string;
  guestNameRequired: string;
  stayDuration: string;
  stayDaysPlaceholder: string;
  stayDaysHint: string;
  stayDaysRequired: string;
  stayDaysInvalid: string;
  stayDaysValue: (days: number) => string;
  editGuest: string;
  updateGuest: string;
  assigningGuest: string;
  updatingGuest: string;
  checkoutGuest: string;
  checkoutTitle: string;
  checkoutDescription: (room: string, guest: string) => string;
  confirmCheckout: string;
  checkingOut: string;
  cancel: string;
  close: string;
  loading: string;
  errorLoading: string;
  retry: string;
  sessionExpired: string;
  apiError: string;
  roomConflict: string;
  assignmentConflict: string;
  assignSuccess: string;
  updateSuccess: string;
  checkoutSuccess: string;
  showingRange: (from: string, to: string, total: number) => string;
  pagination: string;
  previousPage: string;
  nextPage: string;
  pageLabel: (page: number) => string;
  pageOf: (page: number, totalPages: number) => string;
  noRooms: string;
  noRoomsDescription: string;
  tvSection: string;
  tvDescription: string;
  tvStatus: string;
  tvStatusPending: string;
  tvStatusPaired: string;
  tvStatusClaimed: string;
  tvStatusRevoked: string;
  tvNotPaired: string;
  tvPairingCode: string;
  tvPairingCodePlaceholder: string;
  tvPairingCodeInvalid: string;
  tvPair: string;
  tvPairing: string;
  tvWaitingForTv: string;
  tvPairSuccess: string;
  tvReset: string;
  tvRevoke: string;
  tvResetConfirm: string;
  tvRevokeConfirm: string;
  tvResetSuccess: string;
  tvRevokeSuccess: string;
  tvRoomAlreadyPaired: string;
  tvPairingExpired: string;
  tvDeviceModel: string;
  tvAppVersion: string;
  qrSection: string;
  qrDescription: string;
  qrActive: string;
  qrNotIssued: string;
  issueQr: string;
  reissueQr: string;
  revokeQr: string;
  printQr: string;
  issuingQr: string;
  revokingQr: string;
  qrReissueConfirm: string;
  qrRevokeConfirm: string;
  qrIssueSuccess: string;
  qrRevokeSuccess: string;
  qrSheet: string;
  qrSheetDescription: string;
  qrSheetConfirm: string;
  qrSheetGenerating: string;
  qrSheetPrint: string;
  qrSheetClose: string;
  qrCodeAlt: (room: string) => string;
}

export type CatalogUnit = 'CAFE' | 'RESTAURANT' | 'LOUNGE' | 'SPA' | 'BEAUTY_AND_SALON';

export interface CatalogUnitCopy {
  unitName: string;
  workspaceLabel: string;
  catalogLabel: string;
  catalogSubtitle: string;
  requestLabel: string;
  requestSubtitle: string;
  totalLabel: string;
  activeLabel: string;
  unavailableLabel: string;
  searchLabel: string;
  searchPlaceholder: string;
  itemLabel: string;
  itemNamePlaceholder: string;
  itemDetails: string;
  addItem: string;
  createItem: string;
  editItem: string;
  saveItem: string;
  descriptionPlaceholder: string;
  availableNow: string;
  itemCreated: string;
  itemUpdated: string;
  noItems: string;
  noItemsDescription: string;
  itemSubline: string;
  durationLabel?: string;
  durationPlaceholder?: string;
  durationHint?: string;
}

export interface CafeDashboardCopy {
  orders: string;
  ordersSubtitle: string;
  newRequests: string;
  inProcess: string;
  completed: string;
  activeQueue: string;
  history: string;
  allActive: string;
  filterStatus: string;
  room: string;
  roomPlaceholder: string;
  applyFilters: string;
  clearFilters: string;
  request: string;
  requested: string;
  items: string;
  quantity: (count: number) => string;
  viewDetails: string;
  confirmRequest: string;
  markDone: string;
  requestDetails: string;
  requestId: string;
  guestNote: string;
  noNote: string;
  statusHistory: string;
  requestedAt: string;
  confirmedAt: string;
  completedAt: string;
  newStatus: string;
  inProcessStatus: string;
  completedStatus: string;
  moreItems: string;
  noActiveRequests: string;
  noActiveRequestsDescription: string;
  noHistory: string;
  noHistoryDescription: string;
  loading: string;
  retry: string;
  apiError: string;
  sessionExpired: string;
  transitionConflict: string;
  requestUpdated: string;
  lastUpdated: (value: string) => string;
  refresh: string;
  refreshing: string;
}

export type OperationalRole =
  'SPA' | 'RESTAURANT' | 'LOUNGE' | 'BEAUTY_AND_SALON' | 'HOUSEKEEPING' | 'ROOM_MANAGER';
export type OperationalUnit = 'SPA' | 'RESTAURANT' | 'LOUNGE' | 'HOUSEKEEPING' | 'BEAUTY_AND_SALON';

export interface OperationalRoleCopy {
  title: string;
  subtitle: string;
  navLabel: string;
}

export interface OperationalCopy {
  pageTitle: string;
  administration: string;
  mainNavigation: string;
  menu: string;
  roles: Record<OperationalRole, OperationalRoleCopy>;
  unitNames: Record<OperationalUnit, string>;
  newRequests: string;
  inProcess: string;
  completed: string;
  activeQueue: string;
  history: string;
  allActive: string;
  allUnits: string;
  filterStatus: string;
  unit: string;
  room: string;
  roomPlaceholder: string;
  applyFilters: string;
  clearFilters: string;
  request: string;
  requested: string;
  actions: string;
  items: string;
  quantity: (count: number) => string;
  viewDetails: string;
  confirmRequest: string;
  markDone: string;
  requestDetails: string;
  requestId: string;
  guestNote: string;
  noNote: string;
  statusHistory: string;
  requestedAt: string;
  confirmedAt: string;
  completedAt: string;
  newStatus: string;
  inProcessStatus: string;
  completedStatus: string;
  moreItems: string;
  noActiveRequests: string;
  noActiveRequestsDescription: string;
  noHistory: string;
  noHistoryDescription: string;
  readOnly: string;
  readOnlyDescription: string;
  loading: string;
  retry: string;
  apiError: string;
  sessionExpired: string;
  transitionConflict: string;
  requestUpdated: string;
  lastUpdated: (value: string) => string;
  refresh: string;
  refreshing: string;
  showing: (count: number) => string;
  showingRange: (from: number, to: number, total: number) => string;
  pagination: string;
  previousPage: string;
  nextPage: string;
  pageLabel: (page: number) => string;
}

export interface SuperadminCopy {
  pageTitle: string;
  workspaceLabel: string;
  workspaceTitle: string;
  administration: string;
  accessManagement: string;
  mainNavigation: string;
  users: string;
  roles: string;
  usersSubtitle: string;
  rolesSubtitle: string;
  addUser: string;
  createRole: string;
  totalUsers: string;
  activeUsers: string;
  rolesInUse: string;
  searchUsers: string;
  searchUsersPlaceholder: string;
  allStatuses: string;
  active: string;
  inactive: string;
  allRoles: string;
  showing: (count: number) => string;
  user: string;
  email: string;
  role: string;
  status: string;
  updated: string;
  actions: string;
  edit: string;
  deactivate: string;
  reactivate: string;
  resetPassword: string;
  noUsers: string;
  noUsersDescription: string;
  noRoles: string;
  noRolesDescription: string;
  retry: string;
  loading: string;
  errorLoading: string;
  sessionExpired: string;
  apiError: string;
  createUser: string;
  editUser: string;
  userDetails: string;
  displayName: string;
  displayNamePlaceholder: string;
  assignedRoles: string;
  chooseRole: string;
  initialPassword: string;
  confirmPassword: string;
  passwordHint: string;
  saveUser: string;
  cancel: string;
  close: string;
  requiredField: string;
  invalidEmail: string;
  passwordRequired: string;
  passwordMismatch: string;
  saveSuccess: string;
  createSuccess: string;
  updateSuccess: string;
  duplicateEmail: string;
  roleAssignmentError: string;
  deactivateTitle: string;
  deactivateDescription: (name: string) => string;
  confirmDeactivate: string;
  reactivateTitle: string;
  reactivateDescription: (name: string) => string;
  confirmReactivate: string;
  resetPasswordTitle: string;
  resetPasswordDescription: (name: string) => string;
  newPassword: string;
  confirmNewPassword: string;
  resetPasswordAction: string;
  systemRole: string;
  customRole: string;
  protectedRole: string;
  roleSubtitle: string;
  permissions: string;
  usersCount: (count: number) => string;
  permissionsCount: (count: number) => string;
  editRole: string;
  roleName: string;
  roleCode: string;
  roleDescription: string;
  roleDescriptionPlaceholder: string;
  permissionGroupIdentity: string;
  permissionGroupOperations: string;
  permissionGroupDepartment: string;
  permissionGroupCatalog: string;
  saveRole: string;
  deleteRole: string;
  deleteRoleTitle: string;
  deleteRoleDescription: (name: string) => string;
  confirmDelete: string;
  lockedSystemRole: string;
  cannotDeleteAssignedRole: string;
  roleCodeHint: string;
  noPermissionSelected: string;
  roleSaved: string;
  roleCreated: string;
  roleUpdated: string;
  roleDeleted: string;
  roleInUse: string;
  codeInvalid: string;
  roleRequired: string;
  signedInAs: string;
  lastUpdated: string;
  permissionLabels: Record<string, { label: string; description: string }>;
  roleDescriptions: Record<string, string>;
}

export const translations: Record<Language, AuthCopy> = {
  uz: {
    pageTitle: 'Kirish | Hadith Hotel',
    languageLabel: 'Til',
    brandWorkspace: 'Ichki xizmat ish maydoni',
    brandHeadline: 'Har bir mehmon so‘rovi e’tibor bilan boshqariladi.',
    brandSubcopy:
      'Hadith Hotel bo‘ylab resepshn, xonalarni boshqarish va barcha xizmat jamoalari uchun yagona, xotirjam ish maydoni.',
    brandFooterLabel: 'Xodimlar uchun kirish',
    footerPlatform: 'Ichki xizmat platformasi',
    staffWorkspace: 'Xodimlar ish maydoni',
    staffAccess: 'Xodimlar kirishi',
    welcomeBack: 'Xush kelibsiz',
    loginDescription: 'Hadith Hotel xizmat ish maydoniga kirish uchun tizimga kiring.',
    email: 'Email',
    emailPlaceholder: 'Email manzilingizni kiriting',
    password: 'Parol',
    passwordPlaceholder: 'Parolingizni kiriting',
    showPassword: 'Parolni ko‘rsatish',
    hidePassword: 'Parolni yashirish',
    forgotPassword: 'Parolni unutdingizmi?',
    invalidEmail: 'Yaroqli email manzilini kiriting.',
    missingCredentials: 'Davom etish uchun email va parolingizni kiriting.',
    signingIn: 'Kirilmoqda…',
    signIn: 'Kirish',
    invalidCredentials: 'Email yoki parol noto‘g‘ri.',
    serviceUnavailable:
      'Xizmatga ulanib bo‘lmadi. Mahalliy API ishlayotganini tekshiring va qayta urinib ko‘ring.',
    genericError: 'Xatolik yuz berdi. Qayta urinib ko‘ring.',
    internalNote:
      'Faqat ichki foydalanish uchun. Sessiyangiz mehmonxona xizmat platformasi tomonidan himoyalangan.',
    backToSignIn: 'Kirishga qaytish',
    accountRecovery: 'Hisobni tiklash',
    forgotTitle: 'Parolni unutdingizmi?',
    forgotDescription: 'Tiklashning keyingi bosqichini ko‘rish uchun email manzilingizni kiriting.',
    missingEmail: 'Davom etish uchun emailingizni kiriting.',
    continue: 'Davom etish',
    passwordResetNote:
      'Parolni tiklash hozircha mehmonxona tizim administratori tomonidan amalga oshiriladi.',
    recoveryReady: 'Keyingi qadam administrator bilan',
    recoverySuccessDescription:
      'Hisob email manzili qayd etildi. Parolni tiklashni yakunlash uchun mehmonxona tizim administratoriga murojaat qiling.',
    returnToSignIn: 'Kirishga qaytish',
    sessionActive: 'Sessiya faol',
    welcomeUser: (name) => `Xush kelibsiz, ${name}`,
    activeDescription:
      'Xodimlar sessiyangiz faol. Operatsion ish maydoni keyingi bosqichda mavjud bo‘ladi.',
    accessRole: 'Kirish roli',
    signOut: 'Chiqish',
    roleLabels: {
      SUPERADMIN: 'Superadmin',
      ROOM_MANAGER: 'Xona menejeri',
      RECEPTIONIST: 'Resepshn',
      SPA: 'SPA',
      RESTAURANT: 'Restoran',
      LOUNGE: 'Lounge',
      HOUSEKEEPING: 'Xonalarni tozalash',
      BEAUTY_AND_SALON: 'Go‘zallik va salon',
      CAFE: 'Kafe',
    },
    cafe: {
      pageTitle: 'Menyu boshqaruvi | Hadith Hotel',
      workspaceLabel: 'Kafe ish maydoni',
      workspaceTitle: '7oz Espresso menyusi',
      administration: 'Ichki boshqaruv',
      menu: 'Menyu',
      menuSubtitle: 'Kafe katalogini boshqarish',
      cafeName: '7oz Espresso',
      mainNavigation: 'Asosiy navigatsiya',
      catalog: 'Katalog',
      totalItems: 'Jami pozitsiyalar',
      activeItems: 'Faol pozitsiyalar',
      unavailableItems: 'Mavjud emas',
      searchMenu: 'Qidirish',
      searchMenuPlaceholder: 'Menyu nomi bo‘yicha qidiring',
      allStatuses: 'Barcha holatlar',
      active: 'Faol',
      inactive: 'Nofaol',
      available: 'Mavjud',
      unavailable: 'Mavjud emas',
      showing: (count) => `${count} ta ko‘rsatilmoqda`,
      showingRange: (from, to, total) => `${from}–${to} / ${total} ta`,
      pagination: 'Sahifalash',
      previousPage: 'Oldingi',
      nextPage: 'Keyingi',
      pageLabel: (page) => `${page}-sahifa`,
      item: 'Pozitsiya',
      price: 'Narx',
      status: 'Holat',
      availability: 'Mavjudlik',
      sortOrder: 'Tartib',
      actions: 'Amallar',
      edit: 'Tahrirlash',
      activate: 'Faollashtirish',
      deactivate: 'Nofaollashtirish',
      markAvailable: 'Mavjud deb belgilash',
      markUnavailable: 'Mavjud emas deb belgilash',
      addItem: 'Pozitsiya qo‘shish',
      createItem: 'Yangi pozitsiya',
      editItem: 'Pozitsiyani tahrirlash',
      itemDetails: 'Pozitsiya ma’lumotlari',
      itemName: 'Nomi',
      itemNamePlaceholder: 'Masalan, Iced Americano',
      description: 'Tavsif',
      descriptionPlaceholder: 'Mehmonlar ko‘rishi mumkin bo‘lgan qisqa tavsif',
      pricePlaceholder: 'Narxni kiriting',
      currency: 'Valyuta',
      currencyPlaceholder: 'UZS',
      availableNow: 'Hozir mavjud',
      quantityAllowed: 'Miqdorni tanlash mumkin',
      visibleToGuests: 'Mehmonlarga ko‘rinadi',
      saveItem: 'Pozitsiyani saqlash',
      cancel: 'Bekor qilish',
      close: 'Yopish',
      requiredField: 'Bu maydon majburiy.',
      invalidPrice: 'Narx nol yoki undan katta bo‘lishi kerak.',
      noItems: 'Pozitsiyalar topilmadi',
      noItemsDescription: 'Qidiruv yoki filtrni o‘zgartiring, yoxud yangi pozitsiya qo‘shing.',
      loading: 'Yuklanmoqda…',
      errorLoading: 'Katalogni yuklab bo‘lmadi.',
      retry: 'Qayta urinish',
      sessionExpired: 'Sessiya tugadi. Qayta kiring.',
      apiError: 'Amalni bajarib bo‘lmadi. Qayta urinib ko‘ring.',
      duplicateItem: 'Bu nomli pozitsiya allaqachon mavjud.',
      itemCreated: 'Pozitsiya yaratildi.',
      itemUpdated: 'Pozitsiya yangilandi.',
      statusUpdated: 'Holat yangilandi.',
      lockedUnit: 'Bu ish maydoni faqat 7oz Espresso katalogiga tegishli.',
      noPrice: 'Narx belgilanmagan',
      dashboard: {
        orders: 'Buyurtmalar',
        ordersSubtitle: 'Kafe so‘rovlarini navbatdan yakunlangangacha boshqaring.',
        newRequests: 'Yangi so‘rovlar',
        inProcess: 'Jarayonda',
        completed: 'Yakunlangan',
        activeQueue: 'Faol navbat',
        history: 'Tarix',
        allActive: 'Barcha faol',
        filterStatus: 'Holat',
        room: 'Xona',
        roomPlaceholder: 'Xona raqami bo‘yicha qidiring',
        applyFilters: 'Qo‘llash',
        clearFilters: 'Filtrni tozalash',
        request: 'So‘rov',
        requested: 'Yuborilgan',
        items: 'Pozitsiyalar',
        quantity: (count) => `${count} dona`,
        viewDetails: 'Tafsilotlar',
        confirmRequest: 'Qabul qilish',
        markDone: 'Yakunlash',
        requestDetails: 'So‘rov tafsilotlari',
        requestId: 'So‘rov ID',
        guestNote: 'Mehmon izohi',
        noNote: 'Izoh yo‘q',
        statusHistory: 'Holat tarixi',
        requestedAt: 'Yuborilgan vaqt',
        confirmedAt: 'Qabul qilingan vaqt',
        completedAt: 'Yakunlangan vaqt',
        newStatus: 'Yangi',
        inProcessStatus: 'Jarayonda',
        completedStatus: 'Yakunlangan',
        moreItems: 'ta qo‘shimcha',
        noActiveRequests: 'Faol so‘rovlar yo‘q',
        noActiveRequestsDescription:
          'Hozircha kafeda yangi yoki jarayondagi so‘rovlar mavjud emas.',
        noHistory: 'Tarix bo‘sh',
        noHistoryDescription: 'Yakunlangan kafe so‘rovlari bu yerda ko‘rinadi.',
        loading: 'Yuklanmoqda…',
        retry: 'Qayta urinish',
        apiError: 'Amalni bajarib bo‘lmadi. Qayta urinib ko‘ring.',
        sessionExpired: 'Sessiya tugadi. Qayta kiring.',
        transitionConflict: 'So‘rov allaqachon yangilangan. Ma’lumotni qayta yuklang.',
        requestUpdated: 'So‘rov holati yangilandi.',
        lastUpdated: (value) => `Oxirgi yangilanish: ${value}`,
        refresh: 'Yangilash',
        refreshing: 'Yangilanmoqda…',
      },
    },
    superadmin: {
      pageTitle: 'Boshqaruv | Hadith Hotel',
      workspaceLabel: 'Ma’muriyat ish maydoni',
      workspaceTitle: 'Kirish va jamoani boshqaring',
      administration: 'Ma’muriyat',
      accessManagement: 'Kirishni boshqarish',
      mainNavigation: 'Asosiy navigatsiya',
      users: 'Foydalanuvchilar',
      roles: 'Rollar',
      usersSubtitle: 'Xodim hisoblari, rollari va kirish holatini boshqaring.',
      rolesSubtitle: 'Tizimdagi ruxsat to‘plamlarini aniq va xavfsiz boshqaring.',
      addUser: 'Foydalanuvchi qo‘shish',
      createRole: 'Rol yaratish',
      totalUsers: 'Jami foydalanuvchi',
      activeUsers: 'Faol foydalanuvchi',
      rolesInUse: 'Ishlatilayotgan rollar',
      searchUsers: 'Qidirish',
      searchUsersPlaceholder: 'Ism yoki email bo‘yicha qidiring',
      allStatuses: 'Barcha holatlar',
      active: 'Faol',
      inactive: 'Nofaol',
      allRoles: 'Barcha rollar',
      showing: (count) => `${count} ta ko‘rsatilmoqda`,
      user: 'Foydalanuvchi',
      email: 'Email',
      role: 'Rol',
      status: 'Holat',
      updated: 'Yangilangan',
      actions: 'Amallar',
      edit: 'Tahrirlash',
      deactivate: 'Nofaol qilish',
      reactivate: 'Faollashtirish',
      resetPassword: 'Parolni tiklash',
      noUsers: 'Foydalanuvchilar topilmadi',
      noUsersDescription: 'Qidiruv yoki filtrni o‘zgartiring, yoki yangi xodim hisobini yarating.',
      noRoles: 'Rollar topilmadi',
      noRolesDescription: 'Hozircha maxsus rol mavjud emas. Birinchi rolni yarating.',
      retry: 'Qayta urinish',
      loading: 'Yuklanmoqda…',
      errorLoading: 'Ma’lumotlarni yuklashda xatolik yuz berdi.',
      sessionExpired: 'Sessiya tugagan. Qayta kiring.',
      apiError: 'Amalni bajarib bo‘lmadi. Qayta urinib ko‘ring.',
      createUser: 'Yangi foydalanuvchi',
      editUser: 'Foydalanuvchini tahrirlash',
      userDetails: 'Foydalanuvchi ma’lumotlari',
      displayName: 'To‘liq ism',
      displayNamePlaceholder: 'Masalan, Siti Receptionist',
      assignedRoles: 'Biriktirilgan rollar',
      chooseRole: 'Rolni tanlang',
      initialPassword: 'Boshlang‘ich parol',
      confirmPassword: 'Parolni tasdiqlang',
      passwordHint: 'Kamida 8 ta belgi. Parol xodimga xavfsiz kanal orqali beriladi.',
      saveUser: 'Foydalanuvchini saqlash',
      cancel: 'Bekor qilish',
      close: 'Yopish',
      requiredField: 'Bu maydon majburiy.',
      invalidEmail: 'Yaroqli email manzilini kiriting.',
      passwordRequired: 'Parol kamida 8 ta belgidan iborat bo‘lishi kerak.',
      passwordMismatch: 'Parollar mos kelmadi.',
      saveSuccess: 'O‘zgarishlar saqlandi.',
      createSuccess: 'Foydalanuvchi yaratildi.',
      updateSuccess: 'Foydalanuvchi yangilandi.',
      duplicateEmail: 'Bu email bilan foydalanuvchi allaqachon mavjud.',
      roleAssignmentError: 'Tanlangan rollardan biri mavjud emas.',
      deactivateTitle: 'Foydalanuvchini nofaol qilasizmi?',
      deactivateDescription: (name) =>
        `${name} tizimga kira olmaydi, lekin uning tarixi saqlanadi.`,
      confirmDeactivate: 'Nofaol qilish',
      reactivateTitle: 'Foydalanuvchini faollashtirasizmi?',
      reactivateDescription: (name) => `${name} yana tizimga kirishi mumkin bo‘ladi.`,
      confirmReactivate: 'Faollashtirish',
      resetPasswordTitle: 'Parolni yangilaysizmi?',
      resetPasswordDescription: (name) => `${name} uchun yangi vaqtinchalik parol belgilang.`,
      newPassword: 'Yangi parol',
      confirmNewPassword: 'Yangi parolni tasdiqlang',
      resetPasswordAction: 'Parolni yangilash',
      systemRole: 'Tizim roli',
      customRole: 'Maxsus rol',
      protectedRole: 'Himoyalangan',
      roleSubtitle: 'Rollar foydalanuvchilarga beriladigan ruxsatlar to‘plamidir.',
      permissions: 'Ruxsatlar',
      usersCount: (count) => `${count} ta foydalanuvchi`,
      permissionsCount: (count) => `${count} ta ruxsat`,
      editRole: 'Rolni tahrirlash',
      roleName: 'Rol nomi',
      roleCode: 'Rol kodi',
      roleDescription: 'Tavsif',
      roleDescriptionPlaceholder: 'Bu rol nima uchun ishlatilishini qisqacha yozing',
      permissionGroupIdentity: 'Hisob va kirish',
      permissionGroupOperations: 'So‘rovlar va ish jarayoni',
      permissionGroupDepartment: 'Bo‘lim va mehmonlar',
      permissionGroupCatalog: 'Menyu va kontent',
      saveRole: 'Rolni saqlash',
      deleteRole: 'Rolni o‘chirish',
      deleteRoleTitle: 'Rolni o‘chirasizmi?',
      deleteRoleDescription: (name) => `${name} o‘chiriladi. Bu amalni qaytarib bo‘lmaydi.`,
      confirmDelete: 'O‘chirish',
      lockedSystemRole: 'Tizim roli o‘zgartirilmaydi',
      cannotDeleteAssignedRole: 'Foydalanuvchilarga biriktirilgan rolni o‘chirib bo‘lmaydi.',
      roleCodeHint: 'Faqat lotin harflari, raqam, chiziqcha yoki pastki chiziq.',
      noPermissionSelected: 'Hech qanday ruxsat tanlanmagan.',
      roleSaved: 'Rol saqlandi.',
      roleCreated: 'Rol yaratildi.',
      roleUpdated: 'Rol yangilandi.',
      roleDeleted: 'Rol o‘chirildi.',
      roleInUse: 'Biriktirilgan',
      codeInvalid: 'Rol kodi noto‘g‘ri formatda.',
      roleRequired: 'Kamida bitta rol tanlang.',
      signedInAs: 'Sifatida kirilgan',
      lastUpdated: 'Oxirgi yangilanish',
      permissionLabels: {
        'request:view': {
          label: 'So‘rovlarni ko‘rish',
          description: 'Bo‘lim so‘rovlar navbatini ko‘rish.',
        },
        'request:confirm': {
          label: 'So‘rovni tasdiqlash',
          description: 'Yangi so‘rovni ish jarayoniga olish.',
        },
        'request:complete': {
          label: 'So‘rovni yakunlash',
          description: 'Bajarilgan so‘rovni yakunlangan deb belgilash.',
        },
        'request:history': {
          label: 'So‘rovlar tarixi',
          description: 'Yakunlangan so‘rovlar tarixini ko‘rish.',
        },
        'room-manager:monitor': {
          label: 'Monitoring',
          description: 'Tasdiqlangan bo‘limlar faoliyatini kuzatish.',
        },
        'receptionist:rooms:view': {
          label: 'Xonalarni ko‘rish',
          description: 'Xonalar va ularning holatini ko‘rish.',
        },
        'receptionist:guest:assign': {
          label: 'Mehmonni biriktirish',
          description: 'Mehmonni xonaga biriktirish.',
        },
        'receptionist:guest:update': {
          label: 'Mehmon ma’lumotini o‘zgartirish',
          description: 'Biriktirilgan mehmon ma’lumotlarini yangilash.',
        },
        'receptionist:guest:checkout': {
          label: 'Checkout',
          description: 'Mehmonning chiqishini rasmiylashtirish.',
        },
        'receptionist:tv:pair': {
          label: 'TV qurilmasini ulash',
          description: 'Smart TV ni xonaga biriktirish yoki tiklash.',
        },
        'menu:manage': {
          label: 'Menyuni boshqarish',
          description: 'Menyu pozitsiyalarini tahrirlash.',
        },
        'user:manage': {
          label: 'Foydalanuvchilarni boshqarish',
          description: 'Xodim hisoblarini yaratish va boshqarish.',
        },
        'role:manage': {
          label: 'Rollarni boshqarish',
          description: 'Rollar va ularning ruxsatlarini boshqarish.',
        },
      },
      roleDescriptions: {
        SUPERADMIN: 'Xodimlar hisobi va kirish rollarini boshqaradi.',
        ROOM_MANAGER: 'Tasdiqlangan mehmonxona bo‘limlari so‘rovlarini kuzatadi.',
        RECEPTIONIST: 'Mehmon, xona, checkout va TV biriktirish jarayonlarini boshqaradi.',
        SPA: 'SPA so‘rovlarini va xizmatlar katalogini boshqaradi.',
        RESTAURANT: 'Restoran so‘rovlarini boshqaradi.',
        LOUNGE: 'Lounge so‘rovlarini boshqaradi.',
        HOUSEKEEPING: 'Housekeeping so‘rovlarini boshqaradi.',
        BEAUTY_AND_SALON: 'Go‘zallik va salon so‘rovlari hamda xizmatlar katalogini boshqaradi.',
        CAFE: 'Kafe so‘rovlari va menyu katalogini boshqaradi.',
      },
    },
    receptionist: {
      pageTitle: 'Xonalar | Hadith Hotel',
      mainNavigation: 'Asosiy navigatsiya',
      rooms: 'Xonalar',
      room: 'Xona',
      searchRooms: 'Qidirish',
      searchPlaceholder: 'Xona raqami yoki mehmon nomi bo‘yicha qidiring',
      floorNavigation: 'Qavatlar',
      floorLabel: (floor) => `${floor}-qavat`,
      floorRange: (from, to) => `${from}–${to}-xonalar`,
      roomBoard: 'Xonalar paneli',
      searchResults: 'Qidiruv natijalari',
      statusLegend: 'Xona holati',
      vacant: 'Bo‘sh',
      occupied: 'Band',
      assignGuest: 'Mehmonni biriktirish',
      openRoom: 'Xonani ochish',
      assignGuestTitle: 'Mehmonni xonaga biriktirish',
      guestDetails: 'Mehmon ma’lumotlari',
      editGuestTitle: 'Mehmon ismini tahrirlash',
      assignGuestDescription: 'Ushbu xonaga joylashtirilgan mehmon nomini kiriting.',
      editGuestDescription: 'Faol mehmon biriktirmasidagi ismni yangilang.',
      occupiedRoomDescription: 'Bu xona faol mehmon biriktirmasiga ega.',
      guestName: 'Mehmon ismi',
      guestNamePlaceholder: 'Mehmonning to‘liq ismi',
      guestNameHint: 'Bu ism mehmonning xonasidagi TV welcome ekranida ko‘rsatiladi.',
      guestNameRequired: 'Mehmon ismini kiriting.',
      stayDuration: 'Turar joy muddati (kun)',
      stayDaysPlaceholder: 'Kunlar sonini kiriting',
      stayDaysHint: 'Mehmonning rejalashtirilgan turar joy muddati.',
      stayDaysRequired: 'Turar joy kunlarini kiriting.',
      stayDaysInvalid: 'Turar joy 1 dan 365 kungacha bo‘lishi kerak.',
      stayDaysValue: (days) => `${days} kun`,
      editGuest: 'Mehmonni tahrirlash',
      updateGuest: 'Mehmonni yangilash',
      assigningGuest: 'Biriktirilmoqda…',
      updatingGuest: 'Yangilanmoqda…',
      checkoutGuest: 'Checkout',
      checkoutTitle: 'Mehmonni checkout qilasizmi?',
      checkoutDescription: (room, guest) => `${guest} mehmoni ${room}-xonadan chiqariladi.`,
      confirmCheckout: 'Checkoutni tasdiqlash',
      checkingOut: 'Checkout qilinmoqda…',
      cancel: 'Bekor qilish',
      close: 'Yopish',
      loading: 'Yuklanmoqda…',
      errorLoading: 'Xonalar ma’lumotini yuklab bo‘lmadi.',
      retry: 'Qayta urinish',
      sessionExpired: 'Sessiya tugadi. Qayta kiring.',
      apiError: 'Amalni bajarib bo‘lmadi. Qayta urinib ko‘ring.',
      roomConflict: 'Xona allaqachon band. Panelni yangilang va qayta urinib ko‘ring.',
      assignmentConflict: 'Biriktirma endi faol emas. Panelni yangilang.',
      assignSuccess: 'Mehmon xonaga biriktirildi.',
      updateSuccess: 'Mehmon ma’lumoti yangilandi.',
      checkoutSuccess: 'Mehmon checkout qilindi.',
      showingRange: (from, to, total) => `${from}–${to} / ${total} ta xona`,
      pagination: 'Sahifalash',
      previousPage: 'Oldingi',
      nextPage: 'Keyingi',
      pageLabel: (page) => `${page}-sahifa`,
      pageOf: (page, totalPages) => `${page} / ${totalPages}-sahifa`,
      noRooms: 'Xonalar topilmadi',
      noRoomsDescription: 'Qidiruvni o‘zgartirib ko‘ring.',
      tvSection: 'TV qurilmasi',
      tvDescription: 'TV ekranidagi kodni kiriting va uni shu xonaga biriktiring.',
      tvStatus: 'TV holati',
      tvStatusPending: 'Tasdiq kutilmoqda',
      tvStatusPaired: 'Biriktirilgan',
      tvStatusClaimed: 'Faol',
      tvStatusRevoked: 'Bekor qilingan',
      tvNotPaired: 'Bu xonaga TV biriktirilmagan.',
      tvPairingCode: 'TV pairing kodi',
      tvPairingCodePlaceholder: '6 xonali kod',
      tvPairingCodeInvalid: '6 xonali pairing kodini kiriting.',
      tvPair: 'TV ni biriktirish',
      tvPairing: 'Biriktirilmoqda…',
      tvWaitingForTv: 'TV tasdiqlashi kutilmoqda…',
      tvPairSuccess: 'TV xonaga biriktirildi.',
      tvReset: 'Qayta ulash',
      tvRevoke: 'Bekor qilish',
      tvResetConfirm: 'TV pairingini qayta boshlaysizmi? TV yangi kod ko‘rsatadi.',
      tvRevokeConfirm: 'Bu TV credentialini bekor qilasizmi?',
      tvResetSuccess: 'TV qayta pairing uchun tayyor.',
      tvRevokeSuccess: 'TV credentiali bekor qilindi.',
      tvRoomAlreadyPaired: 'Bu xonada faol TV allaqachon biriktirilgan.',
      tvPairingExpired: 'Pairing kodi eskirgan. TV da yangi kodni oching.',
      tvDeviceModel: 'Model',
      tvAppVersion: 'Ilova versiyasi',
      qrSection: 'Mehmon QR kodi',
      qrDescription: 'QR kodni chop eting va xonaga joylashtiring.',
      qrActive: 'Faol QR kod mavjud.',
      qrNotIssued: 'QR kod hali chiqarilmagan.',
      issueQr: 'QR chiqarish',
      reissueQr: 'QR ni qayta chiqarish',
      revokeQr: 'QR ni bekor qilish',
      printQr: 'QR ni chop etish',
      issuingQr: 'QR chiqarilmoqda…',
      revokingQr: 'Bekor qilinmoqda…',
      qrReissueConfirm: 'Eski QR kod ishlamay qoladi. Yangi QR kod chiqarilsinmi?',
      qrRevokeConfirm: 'Bu xonaning QR kodini bekor qilasizmi?',
      qrIssueSuccess: 'Yangi QR kod tayyor.',
      qrRevokeSuccess: 'QR kod bekor qilindi.',
      qrSheet: 'Barcha QR kodlar',
      qrSheetDescription: '114 ta xona uchun QR kodlarni bir martada chiqarish va chop etish.',
      qrSheetConfirm: 'Faol QR kodlar yangilanadi. 114 ta yangi QR kod chiqarilsinmi?',
      qrSheetGenerating: 'Barcha QR kodlar chiqarilmoqda…',
      qrSheetPrint: 'Varaqni chop etish',
      qrSheetClose: 'Yopish',
      qrCodeAlt: (room) => `${room}-xona mehmon QR kodi`,
    },
  },
  ru: {
    pageTitle: 'Вход | Hadith Hotel',
    languageLabel: 'Язык',
    brandWorkspace: 'Внутреннее пространство сервиса',
    brandHeadline: 'Каждый запрос гостя — с заботой.',
    brandSubcopy:
      'Единое спокойное рабочее пространство для службы приема, управления номерами и всех сервисных команд Hadith Hotel.',
    brandFooterLabel: 'Доступ сотрудников',
    footerPlatform: 'Внутренняя сервисная платформа',
    staffWorkspace: 'Рабочее пространство сотрудников',
    staffAccess: 'Доступ сотрудников',
    welcomeBack: 'С возвращением',
    loginDescription: 'Войдите, чтобы продолжить работу в сервисном пространстве Hadith Hotel.',
    email: 'Электронная почта',
    emailPlaceholder: 'Введите адрес электронной почты',
    password: 'Пароль',
    passwordPlaceholder: 'Введите пароль',
    showPassword: 'Показать пароль',
    hidePassword: 'Скрыть пароль',
    forgotPassword: 'Забыли пароль?',
    invalidEmail: 'Введите корректный адрес электронной почты.',
    missingCredentials: 'Введите электронную почту и пароль, чтобы продолжить.',
    signingIn: 'Выполняется вход…',
    signIn: 'Войти',
    invalidCredentials: 'Неверная электронная почта или пароль.',
    serviceUnavailable:
      'Не удалось подключиться к сервису. Проверьте локальный API и повторите попытку.',
    genericError: 'Произошла ошибка. Повторите попытку.',
    internalNote: 'Только для внутреннего доступа. Сессия защищена сервисной платформой отеля.',
    backToSignIn: 'Вернуться ко входу',
    accountRecovery: 'Восстановление доступа',
    forgotTitle: 'Забыли пароль?',
    forgotDescription:
      'Введите адрес электронной почты, чтобы увидеть следующий шаг восстановления доступа.',
    missingEmail: 'Введите электронную почту, чтобы продолжить.',
    continue: 'Продолжить',
    passwordResetNote: 'Сейчас восстановление пароля выполняется системным администратором отеля.',
    recoveryReady: 'Следующий шаг — администратор',
    recoverySuccessDescription:
      'Адрес электронной почты принят. Обратитесь к системному администратору отеля для завершения сброса пароля.',
    returnToSignIn: 'Вернуться ко входу',
    sessionActive: 'Сессия активна',
    welcomeUser: (name) => `Добро пожаловать, ${name}`,
    activeDescription:
      'Сессия сотрудника активна. Операционное рабочее пространство будет доступно на следующем этапе.',
    accessRole: 'Роль доступа',
    signOut: 'Выйти',
    roleLabels: {
      SUPERADMIN: 'Суперадминистратор',
      ROOM_MANAGER: 'Менеджер номеров',
      RECEPTIONIST: 'Служба приема',
      SPA: 'SPA',
      RESTAURANT: 'Ресторан',
      LOUNGE: 'Лаунж',
      HOUSEKEEPING: 'Хаускипинг',
      BEAUTY_AND_SALON: 'Красота и салон',
      CAFE: 'Кафе',
    },
    cafe: {
      pageTitle: 'Управление меню | Hadith Hotel',
      workspaceLabel: 'Рабочее пространство кафе',
      workspaceTitle: 'Меню 7oz Espresso',
      administration: 'Внутреннее управление',
      menu: 'Меню',
      menuSubtitle: 'Управление каталогом кафе',
      cafeName: '7oz Espresso',
      mainNavigation: 'Основная навигация',
      catalog: 'Каталог',
      totalItems: 'Всего позиций',
      activeItems: 'Активные позиции',
      unavailableItems: 'Нет в наличии',
      searchMenu: 'Поиск',
      searchMenuPlaceholder: 'Поиск по названию меню',
      allStatuses: 'Все статусы',
      active: 'Активна',
      inactive: 'Неактивна',
      available: 'В наличии',
      unavailable: 'Нет в наличии',
      showing: (count) => `Показано: ${count}`,
      showingRange: (from, to, total) => `${from}–${to} из ${total}`,
      pagination: 'Пагинация',
      previousPage: 'Назад',
      nextPage: 'Далее',
      pageLabel: (page) => `Страница ${page}`,
      item: 'Позиция',
      price: 'Цена',
      status: 'Статус',
      availability: 'Наличие',
      sortOrder: 'Порядок',
      actions: 'Действия',
      edit: 'Изменить',
      activate: 'Активировать',
      deactivate: 'Деактивировать',
      markAvailable: 'Отметить как доступное',
      markUnavailable: 'Отметить как недоступное',
      addItem: 'Добавить позицию',
      createItem: 'Новая позиция',
      editItem: 'Изменить позицию',
      itemDetails: 'Данные позиции',
      itemName: 'Название',
      itemNamePlaceholder: 'Например, Iced Americano',
      description: 'Описание',
      descriptionPlaceholder: 'Краткое описание, видимое гостям',
      pricePlaceholder: 'Введите цену',
      currency: 'Валюта',
      currencyPlaceholder: 'UZS',
      availableNow: 'Сейчас в наличии',
      quantityAllowed: 'Можно выбрать количество',
      visibleToGuests: 'Видимо гостям',
      saveItem: 'Сохранить позицию',
      cancel: 'Отмена',
      close: 'Закрыть',
      requiredField: 'Это поле обязательно.',
      invalidPrice: 'Цена должна быть не меньше нуля.',
      noItems: 'Позиции не найдены',
      noItemsDescription: 'Измените поиск или фильтр либо добавьте новую позицию.',
      loading: 'Загрузка…',
      errorLoading: 'Не удалось загрузить каталог.',
      retry: 'Повторить',
      sessionExpired: 'Сессия истекла. Войдите снова.',
      apiError: 'Действие не выполнено. Попробуйте еще раз.',
      duplicateItem: 'Такая позиция уже существует.',
      itemCreated: 'Позиция создана.',
      itemUpdated: 'Позиция обновлена.',
      statusUpdated: 'Статус обновлен.',
      lockedUnit: 'Это пространство относится только к каталогу 7oz Espresso.',
      noPrice: 'Цена не указана',
      dashboard: {
        orders: 'Заказы',
        ordersSubtitle: 'Управляйте запросами кафе — от очереди до завершения.',
        newRequests: 'Новые запросы',
        inProcess: 'В работе',
        completed: 'Завершенные',
        activeQueue: 'Активная очередь',
        history: 'История',
        allActive: 'Все активные',
        filterStatus: 'Статус',
        room: 'Номер',
        roomPlaceholder: 'Поиск по номеру комнаты',
        applyFilters: 'Применить',
        clearFilters: 'Сбросить фильтр',
        request: 'Запрос',
        requested: 'Создан',
        items: 'Позиции',
        quantity: (count) => `${count} шт.`,
        viewDetails: 'Подробнее',
        confirmRequest: 'Принять',
        markDone: 'Завершить',
        requestDetails: 'Детали запроса',
        requestId: 'ID запроса',
        guestNote: 'Комментарий гостя',
        noNote: 'Без комментария',
        statusHistory: 'История статуса',
        requestedAt: 'Время создания',
        confirmedAt: 'Время принятия',
        completedAt: 'Время завершения',
        newStatus: 'Новый',
        inProcessStatus: 'В работе',
        completedStatus: 'Завершен',
        moreItems: 'доп.',
        noActiveRequests: 'Активных запросов нет',
        noActiveRequestsDescription: 'Сейчас нет новых запросов кафе или запросов в работе.',
        noHistory: 'История пуста',
        noHistoryDescription: 'Завершенные запросы кафе появятся здесь.',
        loading: 'Загрузка…',
        retry: 'Повторить',
        apiError: 'Не удалось выполнить действие. Попробуйте еще раз.',
        sessionExpired: 'Сессия истекла. Войдите снова.',
        transitionConflict: 'Запрос уже обновлен. Загрузите данные снова.',
        requestUpdated: 'Статус запроса обновлен.',
        lastUpdated: (value) => `Последнее обновление: ${value}`,
        refresh: 'Обновить',
        refreshing: 'Обновление…',
      },
    },
    superadmin: {
      pageTitle: 'Управление | Hadith Hotel',
      workspaceLabel: 'Пространство администрирования',
      workspaceTitle: 'Управляйте доступом и командой',
      administration: 'Администрирование',
      accessManagement: 'Управление доступом',
      mainNavigation: 'Основная навигация',
      users: 'Пользователи',
      roles: 'Роли',
      usersSubtitle: 'Управление учетными записями сотрудников, ролями и статусом доступа.',
      rolesSubtitle: 'Четко и безопасно управляйте наборами разрешений системы.',
      addUser: 'Добавить пользователя',
      createRole: 'Создать роль',
      totalUsers: 'Всего пользователей',
      activeUsers: 'Активные пользователи',
      rolesInUse: 'Используемые роли',
      searchUsers: 'Поиск',
      searchUsersPlaceholder: 'Поиск по имени или электронной почте',
      allStatuses: 'Все статусы',
      active: 'Активен',
      inactive: 'Неактивен',
      allRoles: 'Все роли',
      showing: (count) => `Показано: ${count}`,
      user: 'Пользователь',
      email: 'Электронная почта',
      role: 'Роль',
      status: 'Статус',
      updated: 'Обновлен',
      actions: 'Действия',
      edit: 'Изменить',
      deactivate: 'Деактивировать',
      reactivate: 'Активировать',
      resetPassword: 'Сбросить пароль',
      noUsers: 'Пользователи не найдены',
      noUsersDescription:
        'Измените поиск или фильтр либо создайте учетную запись нового сотрудника.',
      noRoles: 'Роли не найдены',
      noRolesDescription: 'Пользовательских ролей пока нет. Создайте первую роль.',
      retry: 'Повторить',
      loading: 'Загрузка…',
      errorLoading: 'Не удалось загрузить данные.',
      sessionExpired: 'Сессия истекла. Войдите снова.',
      apiError: 'Не удалось выполнить действие. Повторите попытку.',
      createUser: 'Новый пользователь',
      editUser: 'Изменить пользователя',
      userDetails: 'Данные пользователя',
      displayName: 'Полное имя',
      displayNamePlaceholder: 'Например, Siti Receptionist',
      assignedRoles: 'Назначенные роли',
      chooseRole: 'Выберите роль',
      initialPassword: 'Начальный пароль',
      confirmPassword: 'Подтвердите пароль',
      passwordHint: 'Не менее 8 символов. Передайте пароль сотруднику по защищенному каналу.',
      saveUser: 'Сохранить пользователя',
      cancel: 'Отмена',
      close: 'Закрыть',
      requiredField: 'Это поле обязательно.',
      invalidEmail: 'Введите корректный адрес электронной почты.',
      passwordRequired: 'Пароль должен содержать не менее 8 символов.',
      passwordMismatch: 'Пароли не совпадают.',
      saveSuccess: 'Изменения сохранены.',
      createSuccess: 'Пользователь создан.',
      updateSuccess: 'Пользователь обновлен.',
      duplicateEmail: 'Пользователь с такой электронной почтой уже существует.',
      roleAssignmentError: 'Одна из выбранных ролей не существует.',
      deactivateTitle: 'Деактивировать пользователя?',
      deactivateDescription: (name) => `${name} больше не сможет войти, но история сохранится.`,
      confirmDeactivate: 'Деактивировать',
      reactivateTitle: 'Активировать пользователя?',
      reactivateDescription: (name) => `${name} снова сможет войти в систему.`,
      confirmReactivate: 'Активировать',
      resetPasswordTitle: 'Обновить пароль?',
      resetPasswordDescription: (name) => `Установите новый временный пароль для ${name}.`,
      newPassword: 'Новый пароль',
      confirmNewPassword: 'Подтвердите новый пароль',
      resetPasswordAction: 'Обновить пароль',
      systemRole: 'Системная роль',
      customRole: 'Пользовательская роль',
      protectedRole: 'Защищена',
      roleSubtitle: 'Роли — это наборы разрешений, которые назначаются пользователям.',
      permissions: 'Разрешения',
      usersCount: (count) => `${count} пользователей`,
      permissionsCount: (count) => `${count} разрешений`,
      editRole: 'Изменить роль',
      roleName: 'Название роли',
      roleCode: 'Код роли',
      roleDescription: 'Описание',
      roleDescriptionPlaceholder: 'Кратко опишите назначение этой роли',
      permissionGroupIdentity: 'Учетная запись и доступ',
      permissionGroupOperations: 'Запросы и рабочие процессы',
      permissionGroupDepartment: 'Отдел и гости',
      permissionGroupCatalog: 'Меню и контент',
      saveRole: 'Сохранить роль',
      deleteRole: 'Удалить роль',
      deleteRoleTitle: 'Удалить роль?',
      deleteRoleDescription: (name) => `${name} будет удалена. Это действие нельзя отменить.`,
      confirmDelete: 'Удалить',
      lockedSystemRole: 'Системные роли нельзя изменить',
      cannotDeleteAssignedRole: 'Нельзя удалить роль, назначенную пользователям.',
      roleCodeHint: 'Только латинские буквы, цифры, дефис или нижнее подчеркивание.',
      noPermissionSelected: 'Разрешения не выбраны.',
      roleSaved: 'Роль сохранена.',
      roleCreated: 'Роль создана.',
      roleUpdated: 'Роль обновлена.',
      roleDeleted: 'Роль удалена.',
      roleInUse: 'Назначена',
      codeInvalid: 'Неверный формат кода роли.',
      roleRequired: 'Выберите хотя бы одну роль.',
      signedInAs: 'Вы вошли как',
      lastUpdated: 'Последнее обновление',
      permissionLabels: {
        'request:view': {
          label: 'Просмотр запросов',
          description: 'Просмотр очереди запросов отдела.',
        },
        'request:confirm': {
          label: 'Подтверждение запроса',
          description: 'Принять новый запрос в работу.',
        },
        'request:complete': {
          label: 'Завершение запроса',
          description: 'Отметить выполненный запрос.',
        },
        'request:history': {
          label: 'История запросов',
          description: 'Просмотр истории завершенных запросов.',
        },
        'room-manager:monitor': {
          label: 'Мониторинг',
          description: 'Контроль работы утвержденных отделов.',
        },
        'receptionist:rooms:view': {
          label: 'Просмотр номеров',
          description: 'Просмотр номеров и их статуса.',
        },
        'receptionist:guest:assign': {
          label: 'Назначение гостя',
          description: 'Назначить гостя номеру.',
        },
        'receptionist:guest:update': {
          label: 'Изменение гостя',
          description: 'Обновлять данные назначенного гостя.',
        },
        'receptionist:guest:checkout': { label: 'Checkout', description: 'Оформлять выезд гостя.' },
        'receptionist:tv:pair': {
          label: 'Подключение TV',
          description: 'Привязка или сброс Smart TV.',
        },
        'menu:manage': {
          label: 'Управление меню',
          description: 'Изменять позиции меню.',
        },
        'user:manage': {
          label: 'Управление пользователями',
          description: 'Создавать и управлять учетными записями сотрудников.',
        },
        'role:manage': {
          label: 'Управление ролями',
          description: 'Управлять ролями и их разрешениями.',
        },
      },
      roleDescriptions: {
        SUPERADMIN: 'Управляет учетными записями сотрудников и ролями доступа.',
        ROOM_MANAGER: 'Отслеживает запросы утвержденных отделов отеля.',
        RECEPTIONIST: 'Управляет гостями, номерами, checkout и подключением TV.',
        SPA: 'Управляет запросами SPA и каталогом услуг.',
        RESTAURANT: 'Управляет запросами ресторана.',
        LOUNGE: 'Управляет запросами лаунжа.',
        HOUSEKEEPING: 'Управляет запросами хаускипинга.',
        BEAUTY_AND_SALON: 'Управляет запросами и каталогом услуг красоты и салона.',
        CAFE: 'Управляет запросами и каталогом меню кафе.',
      },
    },
    receptionist: {
      pageTitle: 'Номера | Hadith Hotel',
      mainNavigation: 'Основная навигация',
      rooms: 'Номера',
      room: 'Номер',
      searchRooms: 'Поиск',
      searchPlaceholder: 'Поиск по номеру или имени гостя',
      floorNavigation: 'Этажи',
      floorLabel: (floor) => `${floor}-й этаж`,
      floorRange: (from, to) => `Номера ${from}–${to}`,
      roomBoard: 'Панель номеров',
      searchResults: 'Результаты поиска по всем этажам',
      statusLegend: 'Статус номера',
      vacant: 'Свободен',
      occupied: 'Занят',
      assignGuest: 'Назначить гостя',
      openRoom: 'Открыть номер',
      assignGuestTitle: 'Назначить гостя в номер',
      guestDetails: 'Данные гостя',
      editGuestTitle: 'Изменить имя гостя',
      assignGuestDescription: 'Введите имя гостя, проживающего в этом номере.',
      editGuestDescription: 'Обновите имя в активном назначении гостя.',
      occupiedRoomDescription: 'У этого номера есть активное назначение гостя.',
      guestName: 'Имя гостя',
      guestNamePlaceholder: 'Полное имя гостя',
      guestNameHint: 'Это имя будет показано на приветственном экране TV в номере.',
      guestNameRequired: 'Введите имя гостя.',
      stayDuration: 'Срок проживания (дни)',
      stayDaysPlaceholder: 'Введите количество дней',
      stayDaysHint: 'Планируемая продолжительность проживания гостя.',
      stayDaysRequired: 'Введите срок проживания в днях.',
      stayDaysInvalid: 'Срок проживания должен быть от 1 до 365 дней.',
      stayDaysValue: (days) => `${days} ${days === 1 ? 'день' : days < 5 ? 'дня' : 'дней'}`,
      editGuest: 'Изменить гостя',
      updateGuest: 'Обновить гостя',
      assigningGuest: 'Назначение…',
      updatingGuest: 'Обновление…',
      checkoutGuest: 'Выезд',
      checkoutTitle: 'Оформить выезд гостя?',
      checkoutDescription: (room, guest) =>
        `Гость ${guest} будет оформлен на выезд из номера ${room}.`,
      confirmCheckout: 'Подтвердить выезд',
      checkingOut: 'Оформление выезда…',
      cancel: 'Отмена',
      close: 'Закрыть',
      loading: 'Загрузка…',
      errorLoading: 'Не удалось загрузить данные номеров.',
      retry: 'Повторить',
      sessionExpired: 'Сессия истекла. Войдите снова.',
      apiError: 'Не удалось выполнить действие. Повторите попытку.',
      roomConflict: 'Номер уже занят. Обновите панель и попробуйте снова.',
      assignmentConflict: 'Назначение больше не активно. Обновите панель.',
      assignSuccess: 'Гость назначен в номер.',
      updateSuccess: 'Данные гостя обновлены.',
      checkoutSuccess: 'Выезд гостя оформлен.',
      showingRange: (from, to, total) => `${from}–${to} из ${total} номеров`,
      pagination: 'Пагинация',
      previousPage: 'Назад',
      nextPage: 'Далее',
      pageLabel: (page) => `Страница ${page}`,
      pageOf: (page, totalPages) => `Страница ${page} из ${totalPages}`,
      noRooms: 'Номера не найдены',
      noRoomsDescription: 'Измените поисковый запрос и попробуйте снова.',
      tvSection: 'TV устройства',
      tvDescription: 'Введите код на экране TV и привяжите устройство к этому номеру.',
      tvStatus: 'Статус TV',
      tvStatusPending: 'Ожидает подтверждения',
      tvStatusPaired: 'Привязан',
      tvStatusClaimed: 'Активен',
      tvStatusRevoked: 'Отозван',
      tvNotPaired: 'К этому номеру TV не привязан.',
      tvPairingCode: 'Код pairing TV',
      tvPairingCodePlaceholder: '6-значный код',
      tvPairingCodeInvalid: 'Введите 6-значный код pairing.',
      tvPair: 'Привязать TV',
      tvPairing: 'Привязка…',
      tvWaitingForTv: 'Ожидание подтверждения TV…',
      tvPairSuccess: 'TV привязан к номеру.',
      tvReset: 'Подключить заново',
      tvRevoke: 'Отозвать',
      tvResetConfirm: 'Начать pairing TV заново? На TV появится новый код.',
      tvRevokeConfirm: 'Отозвать credential этого TV?',
      tvResetSuccess: 'TV готов к повторному pairing.',
      tvRevokeSuccess: 'Credential TV отозван.',
      tvRoomAlreadyPaired: 'К этому номеру уже привязан активный TV.',
      tvPairingExpired: 'Срок кода истёк. Откройте новый код на TV.',
      tvDeviceModel: 'Модель',
      tvAppVersion: 'Версия приложения',
      qrSection: 'QR-код гостя',
      qrDescription: 'Распечатайте QR-код и разместите его в номере.',
      qrActive: 'Активный QR-код выпущен.',
      qrNotIssued: 'QR-код ещё не выпущен.',
      issueQr: 'Выпустить QR',
      reissueQr: 'Выпустить заново',
      revokeQr: 'Отозвать QR',
      printQr: 'Печать QR',
      issuingQr: 'Выпуск QR…',
      revokingQr: 'Отзыв…',
      qrReissueConfirm: 'Старый QR перестанет работать. Выпустить новый QR?',
      qrRevokeConfirm: 'Отозвать QR-код этого номера?',
      qrIssueSuccess: 'Новый QR-код готов.',
      qrRevokeSuccess: 'QR-код отозван.',
      qrSheet: 'Все QR-коды',
      qrSheetDescription: 'Выпустить и распечатать QR-коды для всех 114 номеров.',
      qrSheetConfirm: 'Активные QR-коды будут заменены. Выпустить 114 новых QR-кодов?',
      qrSheetGenerating: 'Выпуск QR-кодов для всех номеров…',
      qrSheetPrint: 'Распечатать лист',
      qrSheetClose: 'Закрыть',
      qrCodeAlt: (room) => `QR-код гостя для номера ${room}`,
    },
  },
  en: {
    pageTitle: 'Staff access | Hadith Hotel',
    languageLabel: 'Language',
    brandWorkspace: 'Internal service workspace',
    brandHeadline: 'Every guest request, handled with care.',
    brandSubcopy:
      'A calm, shared workspace for reception, room management, and every service team across Hadith Hotel.',
    brandFooterLabel: 'Staff access',
    footerPlatform: 'Internal service platform',
    staffWorkspace: 'Staff workspace',
    staffAccess: 'Staff access',
    welcomeBack: 'Welcome back',
    loginDescription: 'Sign in to continue to the Hadith Hotel service workspace.',
    email: 'Email',
    emailPlaceholder: 'Enter your email address',
    password: 'Password',
    passwordPlaceholder: 'Enter your password',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    forgotPassword: 'Forgot password?',
    invalidEmail: 'Enter a valid email address.',
    missingCredentials: 'Enter your email and password to continue.',
    signingIn: 'Signing in…',
    signIn: 'Sign in',
    invalidCredentials: 'The email or password is incorrect.',
    serviceUnavailable: 'We could not reach the service. Check the local API and try again.',
    genericError: 'Something went wrong. Please try again.',
    internalNote: 'Internal access only. Your session is protected by the hotel service platform.',
    backToSignIn: 'Back to sign in',
    accountRecovery: 'Account recovery',
    forgotTitle: 'Forgot your password?',
    forgotDescription: 'Enter your email address to see the next step for recovering access.',
    missingEmail: 'Enter your email address to continue.',
    continue: 'Continue',
    passwordResetNote: 'Password resets are currently completed by the hotel system administrator.',
    recoveryReady: 'Next step is with your administrator',
    recoverySuccessDescription:
      'We noted the account email. Please contact the hotel system administrator to complete the password reset.',
    returnToSignIn: 'Return to sign in',
    sessionActive: 'Session active',
    welcomeUser: (name) => `Welcome, ${name}`,
    activeDescription:
      'Your staff session is active. The operational workspace will be available next.',
    accessRole: 'Access role',
    signOut: 'Sign out',
    roleLabels: {
      SUPERADMIN: 'Superadmin',
      ROOM_MANAGER: 'Room Manager',
      RECEPTIONIST: 'Receptionist',
      SPA: 'SPA',
      RESTAURANT: 'Restaurant',
      LOUNGE: 'Lounge',
      HOUSEKEEPING: 'Housekeeping',
      BEAUTY_AND_SALON: 'Beauty & Salon',
      CAFE: 'Cafe',
    },
    cafe: {
      pageTitle: 'Menu management | Hadith Hotel',
      workspaceLabel: 'Cafe workspace',
      workspaceTitle: '7oz Espresso menu',
      administration: 'Internal administration',
      menu: 'Menu',
      menuSubtitle: 'Manage the cafe catalog',
      cafeName: '7oz Espresso',
      mainNavigation: 'Main navigation',
      catalog: 'Catalog',
      totalItems: 'Total items',
      activeItems: 'Active items',
      unavailableItems: 'Unavailable',
      searchMenu: 'Search',
      searchMenuPlaceholder: 'Search menu names',
      allStatuses: 'All statuses',
      active: 'Active',
      inactive: 'Inactive',
      available: 'Available',
      unavailable: 'Unavailable',
      showing: (count) => `Showing ${count}`,
      showingRange: (from, to, total) => `${from}–${to} of ${total}`,
      pagination: 'Pagination',
      previousPage: 'Previous',
      nextPage: 'Next',
      pageLabel: (page) => `Page ${page}`,
      item: 'Item',
      price: 'Price',
      status: 'Status',
      availability: 'Availability',
      sortOrder: 'Order',
      actions: 'Actions',
      edit: 'Edit',
      activate: 'Activate',
      deactivate: 'Deactivate',
      markAvailable: 'Mark available',
      markUnavailable: 'Mark unavailable',
      addItem: 'Add item',
      createItem: 'New item',
      editItem: 'Edit item',
      itemDetails: 'Item details',
      itemName: 'Name',
      itemNamePlaceholder: 'For example, Iced Americano',
      description: 'Description',
      descriptionPlaceholder: 'A short description guests may see',
      pricePlaceholder: 'Enter a price',
      currency: 'Currency',
      currencyPlaceholder: 'UZS',
      availableNow: 'Available now',
      quantityAllowed: 'Quantity can be selected',
      visibleToGuests: 'Visible to guests',
      saveItem: 'Save item',
      cancel: 'Cancel',
      close: 'Close',
      requiredField: 'This field is required.',
      invalidPrice: 'Price must be zero or greater.',
      noItems: 'No items found',
      noItemsDescription: 'Change your search or filter, or add a new item.',
      loading: 'Loading…',
      errorLoading: 'We could not load the catalog.',
      retry: 'Retry',
      sessionExpired: 'Your session has expired. Please sign in again.',
      apiError: 'The action could not be completed. Please try again.',
      duplicateItem: 'An item with this name already exists.',
      itemCreated: 'Item created.',
      itemUpdated: 'Item updated.',
      statusUpdated: 'Status updated.',
      lockedUnit: 'This workspace is limited to the 7oz Espresso catalog.',
      noPrice: 'No price set',
      dashboard: {
        orders: 'Orders',
        ordersSubtitle: 'Move cafe requests from the queue through completion.',
        newRequests: 'New requests',
        inProcess: 'In process',
        completed: 'Completed',
        activeQueue: 'Active queue',
        history: 'History',
        allActive: 'All active',
        filterStatus: 'Status',
        room: 'Room',
        roomPlaceholder: 'Search by room number',
        applyFilters: 'Apply',
        clearFilters: 'Clear filter',
        request: 'Request',
        requested: 'Requested',
        items: 'Items',
        quantity: (count) => `${count} ${count === 1 ? 'item' : 'items'}`,
        viewDetails: 'View details',
        confirmRequest: 'Confirm',
        markDone: 'Mark done',
        requestDetails: 'Request details',
        requestId: 'Request ID',
        guestNote: 'Guest note',
        noNote: 'No note',
        statusHistory: 'Status history',
        requestedAt: 'Requested at',
        confirmedAt: 'Confirmed at',
        completedAt: 'Completed at',
        newStatus: 'New',
        inProcessStatus: 'In process',
        completedStatus: 'Completed',
        moreItems: 'more',
        noActiveRequests: 'No active requests',
        noActiveRequestsDescription: 'New cafe requests and requests in process will appear here.',
        noHistory: 'No history yet',
        noHistoryDescription: 'Completed cafe requests will appear here.',
        loading: 'Loading…',
        retry: 'Retry',
        apiError: 'The action could not be completed. Please try again.',
        sessionExpired: 'Your session has expired. Please sign in again.',
        transitionConflict: 'This request was already updated. Refresh the data and try again.',
        requestUpdated: 'Request status updated.',
        lastUpdated: (value) => `Last updated: ${value}`,
        refresh: 'Refresh',
        refreshing: 'Refreshing…',
      },
    },
    superadmin: {
      pageTitle: 'Administration | Hadith Hotel',
      workspaceLabel: 'Administration workspace',
      workspaceTitle: 'Manage access and your team',
      administration: 'Administration',
      accessManagement: 'Access management',
      mainNavigation: 'Main navigation',
      users: 'Users',
      roles: 'Roles',
      usersSubtitle: 'Manage staff accounts, roles, and access status.',
      rolesSubtitle: 'Keep the system’s permission sets clear and controlled.',
      addUser: 'Add user',
      createRole: 'Create role',
      totalUsers: 'Total users',
      activeUsers: 'Active users',
      rolesInUse: 'Roles in use',
      searchUsers: 'Search',
      searchUsersPlaceholder: 'Search by name or email',
      allStatuses: 'All statuses',
      active: 'Active',
      inactive: 'Inactive',
      allRoles: 'All roles',
      showing: (count) => `Showing ${count}`,
      user: 'User',
      email: 'Email',
      role: 'Role',
      status: 'Status',
      updated: 'Updated',
      actions: 'Actions',
      edit: 'Edit',
      deactivate: 'Deactivate',
      reactivate: 'Reactivate',
      resetPassword: 'Reset password',
      noUsers: 'No users found',
      noUsersDescription: 'Change your search or filter, or create a new staff account.',
      noRoles: 'No roles found',
      noRolesDescription: 'There are no custom roles yet. Create the first one.',
      retry: 'Try again',
      loading: 'Loading…',
      errorLoading: 'We could not load this information.',
      sessionExpired: 'Your session has expired. Please sign in again.',
      apiError: 'The action could not be completed. Please try again.',
      createUser: 'New user',
      editUser: 'Edit user',
      userDetails: 'User details',
      displayName: 'Full name',
      displayNamePlaceholder: 'For example, Siti Receptionist',
      assignedRoles: 'Assigned roles',
      chooseRole: 'Choose a role',
      initialPassword: 'Initial password',
      confirmPassword: 'Confirm password',
      passwordHint:
        'At least 8 characters. Share the password with the staff member through a secure channel.',
      saveUser: 'Save user',
      cancel: 'Cancel',
      close: 'Close',
      requiredField: 'This field is required.',
      invalidEmail: 'Enter a valid email address.',
      passwordRequired: 'The password must be at least 8 characters.',
      passwordMismatch: 'The passwords do not match.',
      saveSuccess: 'Changes saved.',
      createSuccess: 'User created.',
      updateSuccess: 'User updated.',
      duplicateEmail: 'A user with this email already exists.',
      roleAssignmentError: 'One of the selected roles does not exist.',
      deactivateTitle: 'Deactivate this user?',
      deactivateDescription: (name) =>
        `${name} will no longer be able to sign in, but their history will remain.`,
      confirmDeactivate: 'Deactivate',
      reactivateTitle: 'Reactivate this user?',
      reactivateDescription: (name) => `${name} will be able to sign in again.`,
      confirmReactivate: 'Reactivate',
      resetPasswordTitle: 'Update this password?',
      resetPasswordDescription: (name) => `Set a new temporary password for ${name}.`,
      newPassword: 'New password',
      confirmNewPassword: 'Confirm new password',
      resetPasswordAction: 'Update password',
      systemRole: 'System role',
      customRole: 'Custom role',
      protectedRole: 'Protected',
      roleSubtitle: 'Roles are permission sets that can be assigned to staff users.',
      permissions: 'Permissions',
      usersCount: (count) => `${count} ${count === 1 ? 'user' : 'users'}`,
      permissionsCount: (count) => `${count} ${count === 1 ? 'permission' : 'permissions'}`,
      editRole: 'Edit role',
      roleName: 'Role name',
      roleCode: 'Role code',
      roleDescription: 'Description',
      roleDescriptionPlaceholder: 'Briefly describe what this role is for',
      permissionGroupIdentity: 'Identity & access',
      permissionGroupOperations: 'Requests & workflow',
      permissionGroupDepartment: 'Department & guests',
      permissionGroupCatalog: 'Menu & content',
      saveRole: 'Save role',
      deleteRole: 'Delete role',
      deleteRoleTitle: 'Delete this role?',
      deleteRoleDescription: (name) => `${name} will be deleted. This action cannot be undone.`,
      confirmDelete: 'Delete',
      lockedSystemRole: 'System roles cannot be changed',
      cannotDeleteAssignedRole: 'A role assigned to users cannot be deleted.',
      roleCodeHint: 'Use letters, numbers, hyphens, or underscores only.',
      noPermissionSelected: 'No permissions selected.',
      roleSaved: 'Role saved.',
      roleCreated: 'Role created.',
      roleUpdated: 'Role updated.',
      roleDeleted: 'Role deleted.',
      roleInUse: 'Assigned',
      codeInvalid: 'The role code format is invalid.',
      roleRequired: 'Choose at least one role.',
      signedInAs: 'Signed in as',
      lastUpdated: 'Last updated',
      permissionLabels: {
        'request:view': {
          label: 'View requests',
          description: 'View the department request queue.',
        },
        'request:confirm': {
          label: 'Confirm requests',
          description: 'Accept a new request into the workflow.',
        },
        'request:complete': {
          label: 'Complete requests',
          description: 'Mark a fulfilled request as complete.',
        },
        'request:history': {
          label: 'Request history',
          description: 'View completed request history.',
        },
        'room-manager:monitor': {
          label: 'Monitoring',
          description: 'Monitor approved hotel department activity.',
        },
        'receptionist:rooms:view': {
          label: 'View rooms',
          description: 'View rooms and their current status.',
        },
        'receptionist:guest:assign': {
          label: 'Assign guests',
          description: 'Assign a guest to a room.',
        },
        'receptionist:guest:update': {
          label: 'Update guests',
          description: 'Update an assigned guest’s details.',
        },
        'receptionist:guest:checkout': {
          label: 'Checkout',
          description: 'Complete a guest checkout.',
        },
        'receptionist:tv:pair': {
          label: 'Pair TV devices',
          description: 'Pair or reset a Smart TV device.',
        },
        'menu:manage': { label: 'Manage menus', description: 'Edit menu items.' },
        'user:manage': { label: 'Manage users', description: 'Create and manage staff accounts.' },
        'role:manage': {
          label: 'Manage roles',
          description: 'Manage roles and their permissions.',
        },
      },
      roleDescriptions: {
        SUPERADMIN: 'Manages staff accounts and access roles.',
        ROOM_MANAGER: 'Monitors requests across approved hotel departments.',
        RECEPTIONIST: 'Manages guests, rooms, checkout, and TV pairing.',
        SPA: 'Manages SPA requests and the service catalog.',
        RESTAURANT: 'Manages restaurant requests.',
        LOUNGE: 'Manages lounge requests.',
        HOUSEKEEPING: 'Manages housekeeping requests.',
        BEAUTY_AND_SALON: 'Manages beauty and salon requests and the service catalog.',
        CAFE: 'Manages cafe requests and the menu catalog.',
      },
    },
    receptionist: {
      pageTitle: 'Rooms | Hadith Hotel',
      mainNavigation: 'Main navigation',
      rooms: 'Rooms',
      room: 'Room',
      searchRooms: 'Search rooms',
      searchPlaceholder: 'Search room number or guest name',
      floorNavigation: 'Guest floors',
      floorLabel: (floor) => `Floor ${floor}`,
      floorRange: (from, to) => `Rooms ${from}–${to}`,
      roomBoard: 'Room board',
      searchResults: 'Search results across all floors',
      statusLegend: 'Room status',
      vacant: 'Vacant',
      occupied: 'Occupied',
      assignGuest: 'Assign guest',
      openRoom: 'Open room',
      assignGuestTitle: 'Assign guest to room',
      guestDetails: 'Guest details',
      editGuestTitle: 'Edit guest name',
      assignGuestDescription: 'Enter the name of the guest staying in this room.',
      editGuestDescription: 'Update the name on the active guest assignment.',
      occupiedRoomDescription: 'This room has an active guest assignment.',
      guestName: 'Guest name',
      guestNamePlaceholder: 'Enter the guest’s full name',
      guestNameHint: 'This name appears on the personalized welcome screen on the room TV.',
      guestNameRequired: 'Enter the guest name.',
      stayDuration: 'Length of stay (days)',
      stayDaysPlaceholder: 'Enter number of days',
      stayDaysHint: 'The guest’s planned length of stay.',
      stayDaysRequired: 'Enter the length of stay.',
      stayDaysInvalid: 'Length of stay must be between 1 and 365 days.',
      stayDaysValue: (days) => `${days} ${days === 1 ? 'day' : 'days'}`,
      editGuest: 'Edit guest',
      updateGuest: 'Update guest',
      assigningGuest: 'Assigning…',
      updatingGuest: 'Updating…',
      checkoutGuest: 'Checkout guest',
      checkoutTitle: 'Check out this guest?',
      checkoutDescription: (room, guest) => `${guest} will be checked out from room ${room}.`,
      confirmCheckout: 'Confirm checkout',
      checkingOut: 'Checking out…',
      cancel: 'Cancel',
      close: 'Close',
      loading: 'Loading…',
      errorLoading: 'Could not load room data.',
      retry: 'Retry',
      sessionExpired: 'Session expired. Please sign in again.',
      apiError: 'The action could not be completed. Try again.',
      roomConflict: 'This room is already occupied. Refresh the board and try again.',
      assignmentConflict: 'This guest assignment is no longer active. Refresh the board.',
      assignSuccess: 'Guest assigned to the room.',
      updateSuccess: 'Guest details updated.',
      checkoutSuccess: 'Guest checked out.',
      showingRange: (from, to, total) => `${from}–${to} of ${total} rooms`,
      pagination: 'Pagination',
      previousPage: 'Previous',
      nextPage: 'Next',
      pageLabel: (page) => `Page ${page}`,
      pageOf: (page, totalPages) => `Page ${page} of ${totalPages}`,
      noRooms: 'No rooms found',
      noRoomsDescription: 'Change your search and try again.',
      tvSection: 'TV device',
      tvDescription: 'Enter the code shown on the TV and map it to this room.',
      tvStatus: 'TV status',
      tvStatusPending: 'Waiting for confirmation',
      tvStatusPaired: 'Paired',
      tvStatusClaimed: 'Active',
      tvStatusRevoked: 'Revoked',
      tvNotPaired: 'No TV is paired with this room.',
      tvPairingCode: 'TV pairing code',
      tvPairingCodePlaceholder: '6-digit code',
      tvPairingCodeInvalid: 'Enter the 6-digit pairing code.',
      tvPair: 'Pair TV',
      tvPairing: 'Pairing…',
      tvWaitingForTv: 'Waiting for the TV to confirm…',
      tvPairSuccess: 'TV paired to the room.',
      tvReset: 'Pair again',
      tvRevoke: 'Revoke',
      tvResetConfirm: 'Restart TV pairing? The TV will show a new code.',
      tvRevokeConfirm: 'Revoke this TV credential?',
      tvResetSuccess: 'TV is ready for pairing again.',
      tvRevokeSuccess: 'TV credential revoked.',
      tvRoomAlreadyPaired: 'This room already has an active TV.',
      tvPairingExpired: 'The pairing code expired. Open a new code on the TV.',
      tvDeviceModel: 'Model',
      tvAppVersion: 'App version',
      qrSection: 'Guest QR code',
      qrDescription: 'Print the QR code and place it in the room.',
      qrActive: 'An active QR code is issued.',
      qrNotIssued: 'No QR code has been issued yet.',
      issueQr: 'Issue QR',
      reissueQr: 'Reissue QR',
      revokeQr: 'Revoke QR',
      printQr: 'Print QR',
      issuingQr: 'Issuing QR…',
      revokingQr: 'Revoking…',
      qrReissueConfirm: 'The old QR will stop working. Issue a new QR code?',
      qrRevokeConfirm: 'Revoke this room’s QR code?',
      qrIssueSuccess: 'New QR code ready.',
      qrRevokeSuccess: 'QR code revoked.',
      qrSheet: 'All room QR codes',
      qrSheetDescription: 'Issue and print QR codes for all 114 rooms at once.',
      qrSheetConfirm: 'Active QR codes will be replaced. Issue 114 new QR codes?',
      qrSheetGenerating: 'Issuing QR codes for all rooms…',
      qrSheetPrint: 'Print sheet',
      qrSheetClose: 'Close',
      qrCodeAlt: (room) => `Guest QR code for room ${room}`,
    },
  },
};

function catalogCopyFromCafe(copy: CafeCopy): CatalogUnitCopy {
  return {
    unitName: copy.cafeName,
    workspaceLabel: copy.workspaceLabel,
    catalogLabel: copy.menu,
    catalogSubtitle: copy.menuSubtitle,
    requestLabel: copy.dashboard.orders,
    requestSubtitle: copy.dashboard.ordersSubtitle,
    totalLabel: copy.totalItems,
    activeLabel: copy.activeItems,
    unavailableLabel: copy.unavailableItems,
    searchLabel: copy.searchMenu,
    searchPlaceholder: copy.searchMenuPlaceholder,
    itemLabel: copy.item,
    itemNamePlaceholder: copy.itemNamePlaceholder,
    itemDetails: copy.itemDetails,
    addItem: copy.addItem,
    createItem: copy.createItem,
    editItem: copy.editItem,
    saveItem: copy.saveItem,
    descriptionPlaceholder: copy.descriptionPlaceholder,
    availableNow: copy.availableNow,
    itemCreated: copy.itemCreated,
    itemUpdated: copy.itemUpdated,
    noItems: copy.noItems,
    noItemsDescription: copy.noItemsDescription,
    itemSubline: copy.catalog,
  };
}

export const catalogUnitCopy: Record<Language, Record<CatalogUnit, CatalogUnitCopy>> = {
  uz: {
    CAFE: catalogCopyFromCafe(translations.uz.cafe),
    RESTAURANT: {
      unitName: 'Saji Nusantara',
      workspaceLabel: 'Saji Nusantara ish maydoni',
      catalogLabel: 'Menyu',
      catalogSubtitle: 'Saji Nusantara menyusini boshqarish',
      requestLabel: 'Buyurtmalar',
      requestSubtitle: 'Restoran buyurtmalarini qabul qiling va yakunlang.',
      totalLabel: 'Jami pozitsiyalar',
      activeLabel: 'Faol pozitsiyalar',
      unavailableLabel: 'Mavjud emas',
      searchLabel: 'Menyudan qidirish',
      searchPlaceholder: 'Menyu nomi bo‘yicha qidiring',
      itemLabel: 'Pozitsiya',
      itemNamePlaceholder: 'Masalan, Nasi Goreng',
      itemDetails: 'Restoran menyusi pozitsiyasi ma’lumotlari.',
      addItem: 'Pozitsiya qo‘shish',
      createItem: 'Yangi pozitsiya',
      editItem: 'Pozitsiyani tahrirlash',
      saveItem: 'Pozitsiyani saqlash',
      descriptionPlaceholder: 'Mehmonlar ko‘rishi mumkin bo‘lgan qisqa tavsif',
      availableNow: 'Mehmonlar uchun mavjud',
      itemCreated: 'Pozitsiya yaratildi.',
      itemUpdated: 'Pozitsiya yangilandi.',
      noItems: 'Pozitsiyalar topilmadi',
      noItemsDescription: 'Menyuga yangi pozitsiya qo‘shishdan boshlang.',
      itemSubline: 'Menyu pozitsiyasi',
    },
    LOUNGE: {
      unitName: 'Lounge',
      workspaceLabel: 'Lounge ish maydoni',
      catalogLabel: 'Menyu',
      catalogSubtitle: 'Lounge menyusini boshqarish',
      requestLabel: 'Buyurtmalar',
      requestSubtitle: 'Lounge buyurtmalarini qabul qiling va yakunlang.',
      totalLabel: 'Jami pozitsiyalar',
      activeLabel: 'Faol pozitsiyalar',
      unavailableLabel: 'Mavjud emas',
      searchLabel: 'Menyudan qidirish',
      searchPlaceholder: 'Menyu nomi bo‘yicha qidiring',
      itemLabel: 'Pozitsiya',
      itemNamePlaceholder: 'Masalan, Lounge platter',
      itemDetails: 'Lounge menyusi pozitsiyasi ma’lumotlari.',
      addItem: 'Pozitsiya qo‘shish',
      createItem: 'Yangi pozitsiya',
      editItem: 'Pozitsiyani tahrirlash',
      saveItem: 'Pozitsiyani saqlash',
      descriptionPlaceholder: 'Mehmonlar ko‘rishi mumkin bo‘lgan qisqa tavsif',
      availableNow: 'Mehmonlar uchun mavjud',
      itemCreated: 'Pozitsiya yaratildi.',
      itemUpdated: 'Pozitsiya yangilandi.',
      noItems: 'Lounge menyusi hali bo‘sh',
      noItemsDescription: 'Lounge menyusi tasdiqlangach, birinchi pozitsiyani qo‘shing.',
      itemSubline: 'Menyu pozitsiyasi',
    },
    SPA: {
      unitName: 'SPA',
      workspaceLabel: 'SPA ish maydoni',
      catalogLabel: 'Xizmatlar',
      catalogSubtitle: 'SPA xizmatlar katalogini boshqarish',
      requestLabel: 'So‘rovlar',
      requestSubtitle: 'SPA xizmatlari bo‘yicha so‘rovlarni qabul qiling va yakunlang.',
      totalLabel: 'Jami xizmatlar',
      activeLabel: 'Faol xizmatlar',
      unavailableLabel: 'Mavjud emas',
      searchLabel: 'Xizmatlardan qidirish',
      searchPlaceholder: 'Xizmat nomi bo‘yicha qidiring',
      itemLabel: 'Xizmat',
      itemNamePlaceholder: 'Masalan, Relaxation Massage',
      itemDetails: 'SPA xizmati ma’lumotlari.',
      addItem: 'Xizmat qo‘shish',
      createItem: 'Yangi xizmat',
      editItem: 'Xizmatni tahrirlash',
      saveItem: 'Xizmatni saqlash',
      descriptionPlaceholder: 'Mehmonlar ko‘rishi mumkin bo‘lgan qisqa xizmat tavsifi',
      availableNow: 'Bron qilish uchun mavjud',
      itemCreated: 'Xizmat yaratildi.',
      itemUpdated: 'Xizmat yangilandi.',
      noItems: 'Xizmatlar topilmadi',
      noItemsDescription: 'SPA katalogiga yangi xizmat qo‘shishdan boshlang.',
      itemSubline: 'SPA xizmati',
      durationLabel: 'Davomiyligi (daqiqa)',
      durationPlaceholder: 'Masalan, 60',
      durationHint: 'Mehmon bron qilishi uchun xizmat davomiyligi.',
    },
    BEAUTY_AND_SALON: {
      unitName: 'Go‘zallik va salon',
      workspaceLabel: 'Go‘zallik va salon ish maydoni',
      catalogLabel: 'Xizmatlar',
      catalogSubtitle: 'Go‘zallik va salon xizmatlari katalogini boshqarish',
      requestLabel: 'So‘rovlar',
      requestSubtitle: 'Go‘zallik va salon xizmatlari so‘rovlarini qabul qiling va yakunlang.',
      totalLabel: 'Jami xizmatlar',
      activeLabel: 'Faol xizmatlar',
      unavailableLabel: 'Mavjud emas',
      searchLabel: 'Xizmatlardan qidirish',
      searchPlaceholder: 'Xizmat nomi bo‘yicha qidiring',
      itemLabel: 'Xizmat',
      itemNamePlaceholder: 'Masalan, Hair Styling',
      itemDetails: 'Go‘zallik va salon xizmati ma’lumotlari.',
      addItem: 'Xizmat qo‘shish',
      createItem: 'Yangi xizmat',
      editItem: 'Xizmatni tahrirlash',
      saveItem: 'Xizmatni saqlash',
      descriptionPlaceholder: 'Mehmonlar ko‘rishi mumkin bo‘lgan qisqa xizmat tavsifi',
      availableNow: 'Bron qilish uchun mavjud',
      itemCreated: 'Xizmat yaratildi.',
      itemUpdated: 'Xizmat yangilandi.',
      noItems: 'Xizmatlar topilmadi',
      noItemsDescription: 'Katalogga yangi xizmat qo‘shishdan boshlang.',
      itemSubline: 'Salon xizmati',
      durationLabel: 'Davomiyligi (daqiqa)',
      durationPlaceholder: 'Masalan, 60',
      durationHint: 'Mehmon bron qilishi uchun xizmat davomiyligi.',
    },
  },
  ru: {
    CAFE: catalogCopyFromCafe(translations.ru.cafe),
    RESTAURANT: {
      unitName: 'Saji Nusantara',
      workspaceLabel: 'Рабочее пространство Saji Nusantara',
      catalogLabel: 'Меню',
      catalogSubtitle: 'Управление меню Saji Nusantara',
      requestLabel: 'Заказы',
      requestSubtitle: 'Принимайте и завершайте заказы ресторана.',
      totalLabel: 'Всего позиций',
      activeLabel: 'Активные позиции',
      unavailableLabel: 'Недоступно',
      searchLabel: 'Поиск в меню',
      searchPlaceholder: 'Поиск по названию меню',
      itemLabel: 'Позиция',
      itemNamePlaceholder: 'Например, Nasi Goreng',
      itemDetails: 'Данные позиции ресторанного меню.',
      addItem: 'Добавить позицию',
      createItem: 'Новая позиция',
      editItem: 'Редактировать позицию',
      saveItem: 'Сохранить позицию',
      descriptionPlaceholder: 'Краткое описание для гостей',
      availableNow: 'Доступно для гостей',
      itemCreated: 'Позиция создана.',
      itemUpdated: 'Позиция обновлена.',
      noItems: 'Позиции не найдены',
      noItemsDescription: 'Начните с добавления первой позиции в меню.',
      itemSubline: 'Позиция меню',
    },
    LOUNGE: {
      unitName: 'Лаунж',
      workspaceLabel: 'Рабочее пространство лаунжа',
      catalogLabel: 'Меню',
      catalogSubtitle: 'Управление меню лаунжа',
      requestLabel: 'Заказы',
      requestSubtitle: 'Принимайте и завершайте заказы лаунжа.',
      totalLabel: 'Всего позиций',
      activeLabel: 'Активные позиции',
      unavailableLabel: 'Недоступно',
      searchLabel: 'Поиск в меню',
      searchPlaceholder: 'Поиск по названию меню',
      itemLabel: 'Позиция',
      itemNamePlaceholder: 'Например, Lounge platter',
      itemDetails: 'Данные позиции меню лаунжа.',
      addItem: 'Добавить позицию',
      createItem: 'Новая позиция',
      editItem: 'Редактировать позицию',
      saveItem: 'Сохранить позицию',
      descriptionPlaceholder: 'Краткое описание для гостей',
      availableNow: 'Доступно для гостей',
      itemCreated: 'Позиция создана.',
      itemUpdated: 'Позиция обновлена.',
      noItems: 'Меню лаунжа пока пусто',
      noItemsDescription: 'Добавьте первую позицию после утверждения меню лаунжа.',
      itemSubline: 'Позиция меню',
    },
    SPA: {
      unitName: 'SPA',
      workspaceLabel: 'Рабочее пространство SPA',
      catalogLabel: 'Услуги',
      catalogSubtitle: 'Управление каталогом услуг SPA',
      requestLabel: 'Запросы',
      requestSubtitle: 'Принимайте и завершайте запросы на услуги SPA.',
      totalLabel: 'Всего услуг',
      activeLabel: 'Активные услуги',
      unavailableLabel: 'Недоступно',
      searchLabel: 'Поиск услуг',
      searchPlaceholder: 'Поиск по названию услуги',
      itemLabel: 'Услуга',
      itemNamePlaceholder: 'Например, Relaxation Massage',
      itemDetails: 'Данные услуги SPA.',
      addItem: 'Добавить услугу',
      createItem: 'Новая услуга',
      editItem: 'Редактировать услугу',
      saveItem: 'Сохранить услугу',
      descriptionPlaceholder: 'Краткое описание услуги для гостей',
      availableNow: 'Доступно для бронирования',
      itemCreated: 'Услуга создана.',
      itemUpdated: 'Услуга обновлена.',
      noItems: 'Услуги не найдены',
      noItemsDescription: 'Начните с добавления первой услуги в каталог SPA.',
      itemSubline: 'Услуга SPA',
      durationLabel: 'Длительность (минуты)',
      durationPlaceholder: 'Например, 60',
      durationHint: 'Продолжительность услуги для бронирования гостем.',
    },
    BEAUTY_AND_SALON: {
      unitName: 'Красота и салон',
      workspaceLabel: 'Рабочее пространство красоты и салона',
      catalogLabel: 'Услуги',
      catalogSubtitle: 'Управление каталогом услуг красоты и салона',
      requestLabel: 'Запросы',
      requestSubtitle: 'Принимайте и завершайте запросы на услуги красоты и салона.',
      totalLabel: 'Всего услуг',
      activeLabel: 'Активные услуги',
      unavailableLabel: 'Недоступно',
      searchLabel: 'Поиск услуг',
      searchPlaceholder: 'Поиск по названию услуги',
      itemLabel: 'Услуга',
      itemNamePlaceholder: 'Например, Hair Styling',
      itemDetails: 'Данные услуги красоты и салона.',
      addItem: 'Добавить услугу',
      createItem: 'Новая услуга',
      editItem: 'Редактировать услугу',
      saveItem: 'Сохранить услугу',
      descriptionPlaceholder: 'Краткое описание услуги для гостей',
      availableNow: 'Доступно для бронирования',
      itemCreated: 'Услуга создана.',
      itemUpdated: 'Услуга обновлена.',
      noItems: 'Услуги не найдены',
      noItemsDescription: 'Начните с добавления первой услуги в каталог.',
      itemSubline: 'Услуга салона',
      durationLabel: 'Длительность (минуты)',
      durationPlaceholder: 'Например, 60',
      durationHint: 'Продолжительность услуги для бронирования гостем.',
    },
  },
  en: {
    CAFE: catalogCopyFromCafe(translations.en.cafe),
    RESTAURANT: {
      unitName: 'Saji Nusantara',
      workspaceLabel: 'Saji Nusantara workspace',
      catalogLabel: 'Menu',
      catalogSubtitle: 'Manage the Saji Nusantara menu',
      requestLabel: 'Orders',
      requestSubtitle: 'Receive and complete restaurant orders.',
      totalLabel: 'Total items',
      activeLabel: 'Active items',
      unavailableLabel: 'Unavailable',
      searchLabel: 'Search menu',
      searchPlaceholder: 'Search menu names',
      itemLabel: 'Item',
      itemNamePlaceholder: 'For example, Nasi Goreng',
      itemDetails: 'Restaurant menu item details.',
      addItem: 'Add item',
      createItem: 'New item',
      editItem: 'Edit item',
      saveItem: 'Save item',
      descriptionPlaceholder: 'A short description guests can see',
      availableNow: 'Available to guests',
      itemCreated: 'Item created.',
      itemUpdated: 'Item updated.',
      noItems: 'No items found',
      noItemsDescription: 'Start by adding the first item to the menu.',
      itemSubline: 'Menu item',
    },
    LOUNGE: {
      unitName: 'Lounge',
      workspaceLabel: 'Lounge workspace',
      catalogLabel: 'Menu',
      catalogSubtitle: 'Manage the lounge menu',
      requestLabel: 'Orders',
      requestSubtitle: 'Receive and complete lounge orders.',
      totalLabel: 'Total items',
      activeLabel: 'Active items',
      unavailableLabel: 'Unavailable',
      searchLabel: 'Search menu',
      searchPlaceholder: 'Search menu names',
      itemLabel: 'Item',
      itemNamePlaceholder: 'For example, Lounge platter',
      itemDetails: 'Lounge menu item details.',
      addItem: 'Add item',
      createItem: 'New item',
      editItem: 'Edit item',
      saveItem: 'Save item',
      descriptionPlaceholder: 'A short description guests can see',
      availableNow: 'Available to guests',
      itemCreated: 'Item created.',
      itemUpdated: 'Item updated.',
      noItems: 'The lounge menu is empty',
      noItemsDescription: 'Add the first item after the lounge menu is approved.',
      itemSubline: 'Menu item',
    },
    SPA: {
      unitName: 'SPA',
      workspaceLabel: 'SPA workspace',
      catalogLabel: 'Services',
      catalogSubtitle: 'Manage the SPA service catalog',
      requestLabel: 'Requests',
      requestSubtitle: 'Receive and complete SPA service requests.',
      totalLabel: 'Total services',
      activeLabel: 'Active services',
      unavailableLabel: 'Unavailable',
      searchLabel: 'Search services',
      searchPlaceholder: 'Search service names',
      itemLabel: 'Service',
      itemNamePlaceholder: 'For example, Relaxation Massage',
      itemDetails: 'SPA service details.',
      addItem: 'Add service',
      createItem: 'New service',
      editItem: 'Edit service',
      saveItem: 'Save service',
      descriptionPlaceholder: 'A short service description guests can see',
      availableNow: 'Available for booking',
      itemCreated: 'Service created.',
      itemUpdated: 'Service updated.',
      noItems: 'No services found',
      noItemsDescription: 'Start by adding the first service to the SPA catalog.',
      itemSubline: 'SPA service',
      durationLabel: 'Duration (minutes)',
      durationPlaceholder: 'For example, 60',
      durationHint: 'The service duration used when guests book it.',
    },
    BEAUTY_AND_SALON: {
      unitName: 'Beauty & Salon',
      workspaceLabel: 'Beauty & Salon workspace',
      catalogLabel: 'Services',
      catalogSubtitle: 'Manage the beauty and salon service catalog',
      requestLabel: 'Requests',
      requestSubtitle: 'Receive and complete beauty and salon service requests.',
      totalLabel: 'Total services',
      activeLabel: 'Active services',
      unavailableLabel: 'Unavailable',
      searchLabel: 'Search services',
      searchPlaceholder: 'Search service names',
      itemLabel: 'Service',
      itemNamePlaceholder: 'For example, Hair Styling',
      itemDetails: 'Beauty and salon service details.',
      addItem: 'Add service',
      createItem: 'New service',
      editItem: 'Edit service',
      saveItem: 'Save service',
      descriptionPlaceholder: 'A short service description guests can see',
      availableNow: 'Available for booking',
      itemCreated: 'Service created.',
      itemUpdated: 'Service updated.',
      noItems: 'No services found',
      noItemsDescription: 'Start by adding the first service to the catalog.',
      itemSubline: 'Salon service',
      durationLabel: 'Duration (minutes)',
      durationPlaceholder: 'For example, 60',
      durationHint: 'The service duration used when guests book it.',
    },
  },
};

export function getCatalogCopy(
  authCopy: AuthCopy,
  language: Language,
  unit: CatalogUnit,
): CafeCopy {
  const unitCopy = catalogUnitCopy[language][unit];
  return {
    ...authCopy.cafe,
    workspaceLabel: unitCopy.workspaceLabel,
    menu: unitCopy.catalogLabel,
    menuSubtitle: unitCopy.catalogSubtitle,
    cafeName: unitCopy.unitName,
    totalItems: unitCopy.totalLabel,
    activeItems: unitCopy.activeLabel,
    unavailableItems: unitCopy.unavailableLabel,
    searchMenu: unitCopy.searchLabel,
    searchMenuPlaceholder: unitCopy.searchPlaceholder,
    item: unitCopy.itemLabel,
    itemNamePlaceholder: unitCopy.itemNamePlaceholder,
    itemDetails: unitCopy.itemDetails,
    addItem: unitCopy.addItem,
    createItem: unitCopy.createItem,
    editItem: unitCopy.editItem,
    saveItem: unitCopy.saveItem,
    descriptionPlaceholder: unitCopy.descriptionPlaceholder,
    availableNow: unitCopy.availableNow,
    itemCreated: unitCopy.itemCreated,
    itemUpdated: unitCopy.itemUpdated,
    noItems: unitCopy.noItems,
    noItemsDescription: unitCopy.noItemsDescription,
    dashboard: {
      ...authCopy.cafe.dashboard,
      orders: unitCopy.requestLabel,
      ordersSubtitle: unitCopy.requestSubtitle,
    },
  };
}

export const operationalCopy: Record<Language, OperationalCopy> = {
  uz: {
    pageTitle: 'Operatsion nazorat | Hadith Hotel',
    administration: 'Ichki boshqaruv',
    mainNavigation: 'Asosiy navigatsiya',
    menu: 'Menyu',
    roles: {
      SPA: {
        title: 'SPA so‘rovlari',
        subtitle: 'SPA xizmatlari bo‘yicha so‘rovlarni boshqaring.',
        navLabel: 'SPA',
      },
      RESTAURANT: {
        title: 'Restoran so‘rovlari',
        subtitle: 'Restoran buyurtmalarini qabul qiling va yakunlang.',
        navLabel: 'Restoran',
      },
      LOUNGE: {
        title: 'Lounge so‘rovlari',
        subtitle: 'Lounge buyurtmalarini qabul qiling va yakunlang.',
        navLabel: 'Lounge',
      },
      BEAUTY_AND_SALON: {
        title: 'Go‘zallik va salon so‘rovlari',
        subtitle: 'Go‘zallik va salon xizmatlari bo‘yicha so‘rovlarni boshqaring.',
        navLabel: 'Go‘zallik va salon',
      },
      HOUSEKEEPING: {
        title: 'Housekeeping so‘rovlari',
        subtitle: 'Xona xizmatlari va tozalash so‘rovlarini boshqaring.',
        navLabel: 'Housekeeping',
      },
      ROOM_MANAGER: {
        title: 'Xonalar monitoringi',
        subtitle: 'SPA, restoran, lounge va housekeeping faoliyatini kuzating.',
        navLabel: 'Monitoring',
      },
    },
    unitNames: {
      SPA: 'SPA',
      RESTAURANT: 'Restoran',
      LOUNGE: 'Lounge',
      HOUSEKEEPING: 'Housekeeping',
      BEAUTY_AND_SALON: 'Go‘zallik va salon',
    },
    newRequests: 'Yangi so‘rovlar',
    inProcess: 'Jarayonda',
    completed: 'Yakunlangan',
    activeQueue: 'Faol navbat',
    history: 'Tarix',
    allActive: 'Barcha faol',
    allUnits: 'Barcha bo‘limlar',
    filterStatus: 'Holat',
    unit: 'Bo‘lim',
    room: 'Xona',
    roomPlaceholder: 'Xona raqami bo‘yicha qidiring',
    applyFilters: 'Qo‘llash',
    clearFilters: 'Filtrni tozalash',
    request: 'So‘rov',
    requested: 'Yuborilgan',
    actions: 'Amallar',
    items: 'Pozitsiyalar',
    quantity: (count) => `${count} dona`,
    viewDetails: 'Tafsilotlar',
    confirmRequest: 'Qabul qilish',
    markDone: 'Yakunlash',
    requestDetails: 'So‘rov tafsilotlari',
    requestId: 'So‘rov ID',
    guestNote: 'Mehmon izohi',
    noNote: 'Izoh yo‘q',
    statusHistory: 'Holat tarixi',
    requestedAt: 'Yuborilgan vaqt',
    confirmedAt: 'Qabul qilingan vaqt',
    completedAt: 'Yakunlangan vaqt',
    newStatus: 'Yangi',
    inProcessStatus: 'Jarayonda',
    completedStatus: 'Yakunlangan',
    moreItems: 'ta qo‘shimcha',
    noActiveRequests: 'Faol so‘rovlar yo‘q',
    noActiveRequestsDescription: 'Yangi yoki jarayondagi so‘rovlar bu yerda ko‘rinadi.',
    noHistory: 'Tarix bo‘sh',
    noHistoryDescription: 'Yakunlangan so‘rovlar bu yerda ko‘rinadi.',
    readOnly: 'Faqat ko‘rish',
    readOnlyDescription:
      'Siz so‘rovlar faoliyatini kuzatishingiz mumkin. Holat o‘zgarishlari tegishli bo‘lim tomonidan amalga oshiriladi.',
    loading: 'Yuklanmoqda…',
    retry: 'Qayta urinish',
    apiError: 'Amalni bajarib bo‘lmadi. Qayta urinib ko‘ring.',
    sessionExpired: 'Sessiya tugadi. Qayta kiring.',
    transitionConflict: 'So‘rov allaqachon yangilangan. Ma’lumotni qayta yuklang.',
    requestUpdated: 'So‘rov holati yangilandi.',
    lastUpdated: (value) => `Oxirgi yangilanish: ${value}`,
    refresh: 'Yangilash',
    refreshing: 'Yangilanmoqda…',
    showing: (count) => `${count} ta ko‘rsatilmoqda`,
    showingRange: (from, to, total) => `${from}–${to} / ${total} ta`,
    pagination: 'Sahifalash',
    previousPage: 'Oldingi',
    nextPage: 'Keyingi',
    pageLabel: (page) => `${page}-sahifa`,
  },
  ru: {
    pageTitle: 'Операционный контроль | Hadith Hotel',
    administration: 'Внутреннее управление',
    mainNavigation: 'Основная навигация',
    menu: 'Меню',
    roles: {
      SPA: {
        title: 'Запросы SPA',
        subtitle: 'Управляйте запросами на услуги SPA.',
        navLabel: 'SPA',
      },
      RESTAURANT: {
        title: 'Запросы ресторана',
        subtitle: 'Принимайте и завершайте заказы ресторана.',
        navLabel: 'Ресторан',
      },
      LOUNGE: {
        title: 'Запросы лаунжа',
        subtitle: 'Принимайте и завершайте заказы лаунжа.',
        navLabel: 'Лаунж',
      },
      BEAUTY_AND_SALON: {
        title: 'Запросы салона красоты',
        subtitle: 'Управляйте запросами на услуги красоты и салона.',
        navLabel: 'Красота и салон',
      },
      HOUSEKEEPING: {
        title: 'Запросы хаускипинга',
        subtitle: 'Управляйте запросами по уборке и обслуживанию номеров.',
        navLabel: 'Хаускипинг',
      },
      ROOM_MANAGER: {
        title: 'Мониторинг номеров',
        subtitle: 'Отслеживайте активность SPA, ресторана, лаунжа и хаускипинга.',
        navLabel: 'Мониторинг',
      },
    },
    unitNames: {
      SPA: 'SPA',
      RESTAURANT: 'Ресторан',
      LOUNGE: 'Лаунж',
      HOUSEKEEPING: 'Хаускипинг',
      BEAUTY_AND_SALON: 'Красота и салон',
    },
    newRequests: 'Новые запросы',
    inProcess: 'В работе',
    completed: 'Завершенные',
    activeQueue: 'Активная очередь',
    history: 'История',
    allActive: 'Все активные',
    allUnits: 'Все отделы',
    filterStatus: 'Статус',
    unit: 'Отдел',
    room: 'Номер',
    roomPlaceholder: 'Поиск по номеру комнаты',
    applyFilters: 'Применить',
    clearFilters: 'Сбросить фильтр',
    request: 'Запрос',
    requested: 'Создан',
    actions: 'Действия',
    items: 'Позиции',
    quantity: (count) => `${count} шт.`,
    viewDetails: 'Подробнее',
    confirmRequest: 'Принять',
    markDone: 'Завершить',
    requestDetails: 'Детали запроса',
    requestId: 'ID запроса',
    guestNote: 'Комментарий гостя',
    noNote: 'Без комментария',
    statusHistory: 'История статуса',
    requestedAt: 'Время создания',
    confirmedAt: 'Время принятия',
    completedAt: 'Время завершения',
    newStatus: 'Новый',
    inProcessStatus: 'В работе',
    completedStatus: 'Завершен',
    moreItems: 'доп.',
    noActiveRequests: 'Активных запросов нет',
    noActiveRequestsDescription: 'Новые запросы и запросы в работе появятся здесь.',
    noHistory: 'История пуста',
    noHistoryDescription: 'Завершенные запросы появятся здесь.',
    readOnly: 'Только просмотр',
    readOnlyDescription:
      'Вы можете наблюдать за активностью запросов. Изменение статуса выполняет соответствующий отдел.',
    loading: 'Загрузка…',
    retry: 'Повторить',
    apiError: 'Не удалось выполнить действие. Попробуйте еще раз.',
    sessionExpired: 'Сессия истекла. Войдите снова.',
    transitionConflict: 'Запрос уже обновлен. Загрузите данные снова.',
    requestUpdated: 'Статус запроса обновлен.',
    lastUpdated: (value) => `Последнее обновление: ${value}`,
    refresh: 'Обновить',
    refreshing: 'Обновление…',
    showing: (count) => `Показано: ${count}`,
    showingRange: (from, to, total) => `${from}–${to} из ${total}`,
    pagination: 'Пагинация',
    previousPage: 'Назад',
    nextPage: 'Далее',
    pageLabel: (page) => `Страница ${page}`,
  },
  en: {
    pageTitle: 'Operations | Hadith Hotel',
    administration: 'Internal operations',
    mainNavigation: 'Main navigation',
    menu: 'Menu',
    roles: {
      SPA: {
        title: 'SPA requests',
        subtitle: 'Manage SPA service requests from arrival through completion.',
        navLabel: 'SPA',
      },
      RESTAURANT: {
        title: 'Restaurant requests',
        subtitle: 'Receive and complete restaurant orders from arrival through fulfillment.',
        navLabel: 'Restaurant',
      },
      LOUNGE: {
        title: 'Lounge requests',
        subtitle: 'Receive and complete lounge orders from arrival through fulfillment.',
        navLabel: 'Lounge',
      },
      BEAUTY_AND_SALON: {
        title: 'Beauty & Salon requests',
        subtitle: 'Manage beauty and salon service requests from arrival through completion.',
        navLabel: 'Beauty & Salon',
      },
      HOUSEKEEPING: {
        title: 'Housekeeping requests',
        subtitle: 'Manage room service and housekeeping requests from arrival through completion.',
        navLabel: 'Housekeeping',
      },
      ROOM_MANAGER: {
        title: 'Room Manager monitoring',
        subtitle: 'Monitor service activity across SPA, restaurant, lounge, and housekeeping.',
        navLabel: 'Monitoring',
      },
    },
    unitNames: {
      SPA: 'SPA',
      RESTAURANT: 'Restaurant',
      LOUNGE: 'Lounge',
      HOUSEKEEPING: 'Housekeeping',
      BEAUTY_AND_SALON: 'Beauty & Salon',
    },
    newRequests: 'New requests',
    inProcess: 'In process',
    completed: 'Completed',
    activeQueue: 'Active queue',
    history: 'History',
    allActive: 'All active',
    allUnits: 'All departments',
    filterStatus: 'Status',
    unit: 'Department',
    room: 'Room',
    roomPlaceholder: 'Search by room number',
    applyFilters: 'Apply',
    clearFilters: 'Clear filters',
    request: 'Request',
    requested: 'Requested',
    actions: 'Actions',
    items: 'Items',
    quantity: (count) => `${count} ${count === 1 ? 'item' : 'items'}`,
    viewDetails: 'View details',
    confirmRequest: 'Confirm',
    markDone: 'Mark done',
    requestDetails: 'Request details',
    requestId: 'Request ID',
    guestNote: 'Guest note',
    noNote: 'No note',
    statusHistory: 'Status history',
    requestedAt: 'Requested at',
    confirmedAt: 'Confirmed at',
    completedAt: 'Completed at',
    newStatus: 'New',
    inProcessStatus: 'In process',
    completedStatus: 'Completed',
    moreItems: 'more',
    noActiveRequests: 'No active requests',
    noActiveRequestsDescription: 'New requests and requests in process will appear here.',
    noHistory: 'No history yet',
    noHistoryDescription: 'Completed requests will appear here.',
    readOnly: 'Read only',
    readOnlyDescription:
      'You can monitor request activity, but status changes are handled by the responsible department.',
    loading: 'Loading…',
    retry: 'Retry',
    apiError: 'The action could not be completed. Please try again.',
    sessionExpired: 'Your session has expired. Please sign in again.',
    transitionConflict: 'This request was already updated. Refresh the data and try again.',
    requestUpdated: 'Request status updated.',
    lastUpdated: (value) => `Last updated: ${value}`,
    refresh: 'Refresh',
    refreshing: 'Refreshing…',
    showing: (count) => `Showing ${count}`,
    showingRange: (from, to, total) => `${from}–${to} of ${total}`,
    pagination: 'Pagination',
    previousPage: 'Previous',
    nextPage: 'Next',
    pageLabel: (page) => `Page ${page}`,
  },
};

export function isLanguage(value: string | null): value is Language {
  return value !== null && LANGUAGE_OPTIONS.some((option) => option.code === value);
}
