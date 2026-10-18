import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '../auth/AuthProvider';
import { api } from '../lib/api';
import { CompleteProfileScreen } from '../screens/auth/CompleteProfileScreen';
import { AddExpenseScreen } from '../screens/AddExpenseScreen';
import { AdjustScreen } from '../screens/AdjustScreen';
import { CheckEmailScreen } from '../screens/auth/CheckEmailScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SetNewPasswordScreen } from '../screens/auth/SetNewPasswordScreen';
import { SignupScreen } from '../screens/auth/SignupScreen';
import { CreateRoomScreen } from '../screens/CreateRoomScreen';
import { DisputesScreen } from '../screens/DisputesScreen';
import { ExpenseDetailScreen } from '../screens/ExpenseDetailScreen';
import { FlagScreen } from '../screens/FlagScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { InboxScreen } from '../screens/InboxScreen';
import { JoinRoomScreen } from '../screens/JoinRoomScreen';
import { LegalScreen } from '../screens/LegalScreen';
import { NeedsScreen } from '../screens/NeedsScreen';
import { NotificationSettingsScreen } from '../screens/NotificationSettingsScreen';
import { PayScreen } from '../screens/PayScreen';
import { PreferencesScreen } from '../screens/PreferencesScreen';
import { RoomMembersScreen } from '../screens/RoomMembersScreen';
import { RoomScreen } from '../screens/RoomScreen';
import { RoomSettingsScreen } from '../screens/RoomSettingsScreen';
import { SettlementScreen } from '../screens/SettlementScreen';
import { colors, currentTheme } from '../ui/theme';
import type { AppStackParamList, AuthStackParamList } from './types';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

const navTheme = () => ({
  ...DefaultTheme,
  dark: currentTheme() === 'dark',
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    primary: colors.primary,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
  },
});

const linking = { prefixes: [Linking.createURL('/')] };

export function RootNavigator() {
  const { t } = useTranslation();
  const { session, loading, recovering, emailVerified } = useAuth();

  const verifiedId = session && emailVerified ? session.user.id : null;
  const [profile, setProfile] = useState<{ id: string; ok: boolean } | null>(null);
  const profileOk = profile && profile.id === verifiedId ? profile.ok : null;
  useEffect(() => {
    if (!verifiedId) return;
    void api
      .profileComplete()
      .catch(() => true)
      .then((ok) => setProfile({ id: verifiedId, ok }));
  }, [verifiedId]);

  if (loading || (verifiedId && profileOk === null)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (session && recovering) return <SetNewPasswordScreen />;
  if (verifiedId && profileOk === false)
    return <CompleteProfileScreen onDone={() => setProfile({ id: verifiedId, ok: true })} />;

  return (
    <NavigationContainer theme={navTheme()} linking={linking}>
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
          <AppStack.Screen
            name="RoomSettings"
            component={RoomSettingsScreen}
            options={{ title: t('settings.title') }}
          />
          <AppStack.Screen name="Adjust" component={AdjustScreen} options={{ title: t('adjust.title') }} />
          <AppStack.Screen
            name="Settlement"
            component={SettlementScreen}
            options={{ title: t('settlement.title') }}
          />
          <AppStack.Screen name="Pay" component={PayScreen} options={{ title: t('payment.claimTitle') }} />
          <AppStack.Screen name="Inbox" component={InboxScreen} options={{ title: t('inbox.title') }} />
          <AppStack.Screen
            name="NotificationSettings"
            component={NotificationSettingsScreen}
            options={{ title: t('notifPrefs.title') }}
          />
          <AppStack.Screen name="Flag" component={FlagScreen} options={{ title: t('flag.title') }} />
          <AppStack.Screen name="Disputes" component={DisputesScreen} options={{ title: t('flag.list') }} />
          <AppStack.Screen name="Needs" component={NeedsScreen} options={{ title: t('need.title') }} />
          <AppStack.Screen name="Legal" component={LegalScreen} options={{ title: '' }} />
          <AppStack.Screen
            name="Preferences"
            component={PreferencesScreen}
            options={{ title: t('prefs.title') }}
          />
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
