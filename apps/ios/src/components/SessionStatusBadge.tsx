import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {SessionStatus} from '@coldtap/shared';
import {Typography, Radius} from '../theme';

const STATUS_CONFIG: Record<SessionStatus, {label: string; color: string; bg: string; border: string}> = {
  CREATED:            {label: 'New',               color: '#6B7280', bg: '#F3F4F6', border: '#E5E7EB'},
  AWAITING_BUYER:     {label: 'Waiting for you',   color: '#2176AE', bg: '#EBF5FC', border: '#BFDBFE'},
  AWAITING_SIGNATURE: {label: 'Awaiting signature', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A'},
  SUBMITTED:          {label: 'Submitted',          color: '#059669', bg: '#ECFDF5', border: '#A7F3D0'},
  VALIDATING:         {label: 'Confirming',         color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE'},
  PAID:               {label: 'Paid',               color: '#059669', bg: '#ECFDF5', border: '#6EE7B7'},
  FAILED:             {label: 'Failed',             color: '#DC2626', bg: '#FEF2F2', border: '#FECACA'},
  EXPIRED:            {label: 'Expired',            color: '#9CA3AF', bg: '#F9FAFB', border: '#E5E7EB'},
};

export default function SessionStatusBadge({status}: {status: SessionStatus}) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.CREATED;
  return (
    <View style={[styles.badge, {backgroundColor: cfg.bg, borderColor: cfg.border}]}>
      <Text style={[styles.label, {color: cfg.color}]}>{cfg.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  label: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    letterSpacing: 0.2,
  },
});
