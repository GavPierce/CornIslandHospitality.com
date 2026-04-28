export type Translations = {
  nav: {
    dashboard: string;
    volunteers: string;
    planning: string;
    calendar: string;
    watchman: string;
    logout: string;
    whatsappSetup: string;
  };
  dashboard: {
    title: string;
    subtitle: string;
    totalHouses: string;
    totalBeds: string;
    maxCapacity: string;
    activeAssignments: string;
    downloadPdf: string;
    registeredVolunteers: string;
    houses: string;
    addHouse: string;
    cancel: string;
    newHouse: string;
    name: string;
    namePlaceholder: string;
    address: string;
    addressPlaceholder: string;
    acceptedVolunteerTypes: string;
    createHouse: string;
    noHousesYet: string;
    noHousesDesc: string;
    delete: string;
    bedsOccupied: string;
    room: string;
    rooms: string;
    roomName: string;
    roomNamePlaceholder: string;
    beds: string;
    add: string;
    addRoom: string;
  };
  volunteers: {
    title: string;
    subtitle: string;
    volunteer: string;
    volunteerPlural: string;
    addVolunteer: string;
    cancel: string;
    newVolunteer: string;
    fullName: string;
    fullNamePlaceholder: string;
    type: string;
    selectType: string;
    emailOptional: string;
    emailPlaceholder: string;
    phoneOptional: string;
    phonePlaceholder: string;
    addVolunteerBtn: string;
    noVolunteers: string;
    noVolunteersDesc: string;
    nameCol: string;
    typeCol: string;
    contactCol: string;
    currentAssignment: string;
    unassigned: string;
    delete: string;
  };
  planning: {
    title: string;
    subtitle: string;
    newAssignment: string;
    volunteer: string;
    selectVolunteer: string;
    allVolunteersAssigned: string;
    room: string;
    selectRoom: string;
    startDate: string;
    endDate: string;
    assignVolunteer: string;
    currentAssignments: string;
    noHouses: string;
    noHousesDesc: string;
    noRoomsYet: string;
    beds: string;
    unassignedVolunteers: string;
    nameCol: string;
    typeCol: string;
    assignmentSuccess: string;
  };
  calendar: {
    title: string;
    subtitle: string;
    prev: string;
    next: string;
    today: string;
    house: string;
    allHouses: string;
    noRooms: string;
    noRoomsDesc: string;
    roomCol: string;
  };
  myDashboard: {
    welcomeLabel: string;
    upcomingShifts: string;
    noUpcomingShifts: string;
    myAssignments: string;
    noAssignments: string;
    viewFullSchedule: string;
  };
  login: {
    title: string;
    subtitle: string;
    phoneLabel: string;
    phonePlaceholder: string;
    phoneHelp: string;
    sendCode: string;
    codeLabel: string;
    codePlaceholder: string;
    codeHelp: string;
    verify: string;
    changePhone: string;
    resend: string;
    sending: string;
    verifying: string;
    signedInAs: string;
    signOut: string;
  };
  watchman: {
    title: string;
    subtitle: string;
    watchman: string;
    watchmanPlural: string;
    addWatchman: string;
    cancel: string;
    newWatchman: string;
    fullName: string;
    fullNamePlaceholder: string;
    emailOptional: string;
    emailPlaceholder: string;
    phoneOptional: string;
    phonePlaceholder: string;
    addWatchmanBtn: string;
    noWatchmen: string;
    noWatchmenDesc: string;
    nameCol: string;
    contactCol: string;
    delete: string;
    schedule: string;
    nightOf: string;
    scheduled: string;
    selectWatchman: string;
    notesOptional: string;
    notesPlaceholder: string;
    assignForNight: string;
    remove: string;
    addSomeoneFirst: string;
    shift: string;
    unfilled: string;
    allSlotsFilled: string;
    needMore: string;
    staffed: string;
    slots: {
      morning: string;
      lunch: string;
      afternoon: string;
      evening: string;
      overnight: string;
    };
  };
  types: {
    singleBrother: string;
    singleSister: string;
    marriedCouple: string;
  };
};

const en: Translations = {
  nav: {
    dashboard: 'Dashboard',
    volunteers: 'Volunteers',
    planning: 'Planning',
    calendar: 'Calendar',
    watchman: 'Night Watchman',
    logout: 'Logout',
    whatsappSetup: 'WhatsApp Setup',
  },
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Overview of all houses, rooms, and current occupancy',
    totalHouses: 'Total Houses',
    totalBeds: 'Total Beds',
    maxCapacity: 'Max Capacity',
    activeAssignments: 'Active Assignments',
    registeredVolunteers: 'Registered Volunteers',
    downloadPdf: 'Download PDF',
    houses: 'Houses',
    addHouse: '+ Add House',
    cancel: 'Cancel',
    newHouse: 'New House',
    name: 'Name',
    namePlaceholder: 'e.g. Rodriguez Home',
    address: 'Address',
    addressPlaceholder: '123 Island Ave',
    acceptedVolunteerTypes: 'Accepted Volunteer Types',
    createHouse: 'Create House',
    noHousesYet: 'No houses yet',
    noHousesDesc: 'Add your first house to start managing accommodations.',
    delete: 'Delete',
    bedsOccupied: 'beds occupied',
    room: 'room',
    rooms: 'rooms',
    roomName: 'Room Name',
    roomNamePlaceholder: 'Room 1',
    beds: 'Beds',
    add: 'Add',
    addRoom: '+ Add Room',
  },
  volunteers: {
    title: 'Volunteers',
    subtitle: 'Manage all registered volunteer workers',
    volunteer: 'Volunteer',
    volunteerPlural: 'Volunteers',
    addVolunteer: '+ Add Volunteer',
    cancel: 'Cancel',
    newVolunteer: 'New Volunteer',
    fullName: 'Full Name',
    fullNamePlaceholder: 'John Smith',
    type: 'Type',
    selectType: 'Select type…',
    emailOptional: 'Email (optional)',
    emailPlaceholder: 'john@example.com',
    phoneOptional: 'Phone (optional)',
    phonePlaceholder: '+1 555-1234',
    addVolunteerBtn: 'Add Volunteer',
    noVolunteers: 'No volunteers registered',
    noVolunteersDesc: 'Add volunteers to start assigning them to rooms.',
    nameCol: 'Name',
    typeCol: 'Type',
    contactCol: 'Contact',
    currentAssignment: 'Current Assignment',
    unassigned: 'Unassigned',
    delete: 'Delete',
  },
  planning: {
    title: 'Planning',
    subtitle: 'Assign volunteers to available rooms',
    newAssignment: 'New Assignment',
    volunteer: 'Volunteer',
    selectVolunteer: 'Select volunteer…',
    allVolunteersAssigned: 'All volunteers assigned',
    room: 'Room',
    selectRoom: 'Select room…',
    startDate: 'Start Date',
    endDate: 'End Date',
    assignVolunteer: 'Assign Volunteer',
    currentAssignments: 'Current Assignments',
    noHouses: 'No houses available',
    noHousesDesc: 'Create houses and rooms on the Dashboard first.',
    noRoomsYet: 'No rooms added yet.',
    beds: 'beds',
    unassignedVolunteers: 'Unassigned Volunteers',
    nameCol: 'Name',
    typeCol: 'Type',
    assignmentSuccess: 'Assignment created successfully!',
  },
  calendar: {
    title: 'Calendar',
    subtitle: 'Timeline view of all room assignments',
    prev: '← Prev',
    next: 'Next →',
    today: 'Today',
    house: 'House',
    allHouses: 'All Houses',
    noRooms: 'No rooms to display',
    noRoomsDesc: 'Add houses and rooms on the Dashboard first.',
    roomCol: 'Room',
  },
  myDashboard: {
    welcomeLabel: 'Signed in as',
    upcomingShifts: 'My upcoming shifts',
    noUpcomingShifts: 'You have no upcoming shifts scheduled.',
    myAssignments: 'My housing assignments',
    noAssignments: 'You have no active housing assignments.',
    viewFullSchedule: 'View full schedule',
  },
  login: {
    title: 'Corn Island',
    subtitle: 'Hospitality Planning',
    phoneLabel: 'Phone number',
    phonePlaceholder: '+505 8888 6666',
    phoneHelp: 'We\u2019ll send a 6-digit code to your WhatsApp.',
    sendCode: 'Send code',
    codeLabel: 'Verification code',
    codePlaceholder: '123456',
    codeHelp: 'Enter the 6-digit code we sent to your WhatsApp.',
    verify: 'Verify and sign in',
    changePhone: 'Use a different number',
    resend: 'Resend code',
    sending: 'Sending\u2026',
    verifying: 'Verifying\u2026',
    signedInAs: 'Signed in as',
    signOut: 'Sign out',
  },
  watchman: {
    title: 'Night Watchman',
    subtitle: 'Manage watchmen and schedule who is on duty each night',
    watchman: 'Watchman',
    watchmanPlural: 'Watchmen',
    addWatchman: '+ Add Watchman',
    cancel: 'Cancel',
    newWatchman: 'New Watchman',
    fullName: 'Full Name',
    fullNamePlaceholder: 'John Smith',
    emailOptional: 'Email (optional)',
    emailPlaceholder: 'john@example.com',
    phoneOptional: 'Phone (optional)',
    phonePlaceholder: '+1 555-1234',
    addWatchmanBtn: 'Add Watchman',
    noWatchmen: 'No watchmen registered',
    noWatchmenDesc: 'Add people signed up for night watchman duty to schedule them.',
    nameCol: 'Name',
    contactCol: 'Contact',
    delete: 'Delete',
    schedule: 'Schedule',
    nightOf: 'Night of',
    scheduled: 'Scheduled',
    selectWatchman: 'Select watchman…',
    notesOptional: 'Notes (optional)',
    notesPlaceholder: 'e.g. backup for second half',
    assignForNight: 'Assign shift',
    remove: 'Remove',
    addSomeoneFirst: 'Add a watchman first, then assign them to shifts.',
    shift: 'Shift',
    unfilled: 'Unfilled',
    allSlotsFilled: 'All shifts are filled for this day.',
    needMore: 'needs more',
    staffed: 'staffed',
    slots: {
      morning: 'Morning',
      lunch: 'Lunch',
      afternoon: 'Afternoon',
      evening: 'Evening',
      overnight: 'Overnight',
    },
  },
  types: {
    singleBrother: 'Single Brother',
    singleSister: 'Single Sister',
    marriedCouple: 'Married Couple',
  },
};

export default en;
