export type Translations = {
  nav: {
    dashboard: string;
    volunteers: string;
    planning: string;
    calendar: string;
  };
  dashboard: {
    title: string;
    subtitle: string;
    totalHouses: string;
    totalCapacity: string;
    activeAssignments: string;
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
  login: {
    title: string;
    subtitle: string;
    passwordLabel: string;
    passwordPlaceholder: string;
    signIn: string;
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
  },
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Overview of all houses, rooms, and current occupancy',
    totalHouses: 'Total Houses',
    totalCapacity: 'Total Capacity',
    activeAssignments: 'Active Assignments',
    registeredVolunteers: 'Registered Volunteers',
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
  login: {
    title: 'Corn Island',
    subtitle: 'Hospitality Planning',
    passwordLabel: 'Administrator Password',
    passwordPlaceholder: 'Enter password...',
    signIn: 'Sign In',
  },
  types: {
    singleBrother: 'Single Brother',
    singleSister: 'Single Sister',
    marriedCouple: 'Married Couple',
  },
};

export default en;
