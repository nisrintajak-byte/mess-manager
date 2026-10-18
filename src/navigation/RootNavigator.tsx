import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '../auth/AuthProvider';
import { AddExpenseScreen } from '../screens/AddExpenseScreen';
import { CheckEmailScreen } from '../screens/auth/CheckEmailScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SetNewPasswordScreen } from '../screens/auth/SetNewPasswordScreen';
import { SignupScreen } from '../screens/auth/SignupScreen';
import { CreateRoomScreen } from '../screens/CreateRoomScreen';
import { ExpenseDetailScreen } from '../screens/ExpenseDetailScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { JoinRoomScreen } from '../screens/JoinRoomScreen';
import { LegalScreen } from '../screens/LegalScreen';
import { RoomMembersScreen } from '../screens/RoomMembersScreen';
import { RoomScreen } from '../screens/RoomScreen';
import { colors } from '../ui/theme';
import type { AppStackParamList, AuthStackParamList } from './types';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

const theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.bg, primary: colors.primary, card: colors.surface },
};

const linking = { prefixes: [Linking.createURL('/')] };

export function RootNavigator() {
  const { t } = useTranslation();
  const { session, loading, recovering, emailVerified } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (session && recovering) return <SetNewPasswordScreen />;

  return (
    <NavigationContainer theme={theme} linking={linking}>
      {session && emailVerified ? (
        <AppStack.Navigator screenOptions={{ headerTintColor: colors.primary }}>
          <AppStack.Screen name="Home" component={HomeScreen} options={{ title: t('home.title') }} />
          <AppStack.Screen
            name="CreateRoom"
            component={CreateRoomScreen}
            options={{ title: t('room.createTitle') }}
          />
          <AppStack.Screen
            name="JoinRoom"
            component={JoinRoomScreen}
            options={{ title: t('room.joinTitle') }}
          />
          <AppStack.Screen name="Room" component={RoomScreen} options={{ title: '' }} />
          <AppStack.Screen
            name="RoomMembers"
            component={RoomMembersScreen}
            options={{ title: t('members.title') }}
          />
          <AppStack.Screen
            name="AddExpense"
            component={AddExpenseScreen}
            options={{ title: t('expense.addTitle') }}
          />
          <AppStack.Screen
            name="ExpenseDetail"
            component={ExpenseDetailScreen}
            options={{ title: t('expense.detailTitle') }}
          />
          <AppStack.Screen name="Legal" component={LegalScreen} options={{ title: '' }} />
        </AppStack.Navigator>
      ) : (
        <AuthStack.Navigator screenOptions={{ headerTintColor: colors.primary }}>
          <AuthStack.Screen name="Login" component={LoginScreen} options={{ title: t('app.name') }} />
          <AuthStack.Screen name="Signup" component={SignupScreen} options={{ title: t('app.name') }} />
          <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: '' }} />
          <AuthStack.Screen name="CheckEmail" component={CheckEmailScreen} options={{ title: '' }} />
          <AuthStack.Screen name="Legal" component={LegalScreen} options={{ title: '' }} />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
}
