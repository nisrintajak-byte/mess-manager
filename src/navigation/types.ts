export type AuthStackParamList = {
  Login: { notice?: string } | undefined;
  Signup: undefined;
  ForgotPassword: { email?: string } | undefined;
  CheckEmail: { email: string };
  Legal: { doc: 'privacy' | 'terms' };
};

export type AppStackParamList = {
  Home: undefined;
  CreateRoom: undefined;
  JoinRoom: undefined;
  Room: { roomId: string };
  RoomMembers: { roomId: string };
  AddExpense: { roomId: string; expenseId?: string };
  ExpenseDetail: { roomId: string; expenseId: string };
  Legal: { doc: 'privacy' | 'terms' };
};
